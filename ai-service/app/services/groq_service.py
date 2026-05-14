import os
import json
import re
import asyncio
import logging
from typing import Any, List, Optional
from pydantic import ValidationError

try:
    from openai import AsyncOpenAI
except ImportError:  # pragma: no cover - exercised only in lean local test environments
    AsyncOpenAI = None

from app.models.schemas import (
    ResumeAnalysisResult,
    AnswerEvaluationResponse,
    QuestionGenerationResponse,
)

logger = logging.getLogger(__name__)

API_KEY = os.getenv("GROQ_API_KEY")
BASE_URL = os.getenv("GROQ_BASE_URL", "https://api.groq.com/openai/v1")
TIMEOUT_SECONDS = float(os.getenv("GROQ_TIMEOUT_SECONDS", "25"))
MAX_RETRIES = int(os.getenv("GROQ_MAX_RETRIES", "2"))
MODEL_CHAIN = [
    m.strip()
    for m in os.getenv(
        "GROQ_MODEL_CHAIN",
        "llama-3.3-70b-versatile,llama-3.1-8b-instant,gemma2-9b-it",
    ).split(",")
    if m.strip()
]

# Separate chain for real-time conversational responses — always prefer the best model
CONVERSATIONAL_MODEL_CHAIN = [
    m.strip()
    for m in os.getenv(
        "GROQ_CONVERSATIONAL_MODEL_CHAIN",
        "llama-3.3-70b-versatile,llama-3.1-8b-instant",
    ).split(",")
    if m.strip()
]

if not API_KEY:
    logger.error("Missing GROQ_API_KEY. AI calls will fail until configured.")

client = AsyncOpenAI(api_key=API_KEY or "missing", base_url=BASE_URL) if AsyncOpenAI else None


def _extract_json(text: str) -> str:
    md_match = re.search(r"```json\s*(.*?)\s*```", text, re.DOTALL)
    if md_match:
        return md_match.group(1)
    md_match2 = re.search(r"```\s*(.*?)\s*```", text, re.DOTALL)
    if md_match2:
        candidate = md_match2.group(1).strip()
        if candidate.startswith("{") or candidate.startswith("["):
            return candidate

    start_obj = text.find("{")
    start_arr = text.find("[")

    if start_obj != -1 and start_arr != -1:
        start_idx = min(start_obj, start_arr)
    elif start_arr != -1:
        start_idx = start_arr
    elif start_obj != -1:
        start_idx = start_obj
    else:
        return text

    end_char = "}" if text[start_idx] == "{" else "]"
    end_idx = text.rfind(end_char)
    if end_idx != -1:
        return text[start_idx:end_idx + 1]
    return text


def _parse_json(text: str) -> Any:
    payload = _extract_json(text)
    try:
        return json.loads(payload)
    except json.JSONDecodeError as e:
        logger.error("JSON parse failed. Raw text: %s", text[:500])
        raise ValueError(f"Failed to parse JSON from AI response: {e}") from e


def _clamp_score(value: float) -> float:
    return max(0.0, min(100.0, float(value)))


def _parse_resume_context(resume_text: str | None) -> dict[str, Any]:
    if not resume_text:
        return {}
    text = resume_text.strip()
    if not text:
        return {}
    try:
        parsed = json.loads(text)
        return parsed if isinstance(parsed, dict) else {}
    except Exception:
        return {"rawText": text}


def _string_list(value: Any) -> List[str]:
    if isinstance(value, list):
        return [item.strip() for item in value if isinstance(item, str) and item.strip()]
    if isinstance(value, str) and value.strip():
        return [value.strip()]
    return []


def _resume_keywords(context: dict[str, Any]) -> List[str]:
    fields = [
        *(_string_list(context.get("projectNames"))),
        *(_string_list(context.get("technologies"))),
        *(_string_list(context.get("skills"))),
        *(_string_list(context.get("queueTools"))),
        *(_string_list(context.get("databaseTools"))),
        *(_string_list(context.get("websocketTools"))),
        *(_string_list(context.get("monitoringTools"))),
        *(_string_list(context.get("deploymentTools"))),
        *(_string_list(context.get("aiTools"))),
        *(_string_list(context.get("scalingClaims"))),
        *(_string_list(context.get("experienceHighlights"))),
    ]
    deduped = []
    seen = set()
    for item in fields:
        key = item.lower()
        if key not in seen:
            seen.add(key)
            deduped.append(item)
    return deduped


def _normalize_words(text: str) -> List[str]:
    return re.findall(r"[a-z0-9']+", (text or "").lower())


def _question_terms(question: str) -> set[str]:
    stop_words = {
        "a", "an", "and", "are", "as", "at", "be", "by", "for", "from", "how", "i", "in", "is",
        "it", "me", "my", "of", "on", "or", "that", "the", "their", "this", "to", "what", "when",
        "where", "which", "who", "why", "with", "you", "your", "tell", "about", "through", "walk",
        "explain", "describe", "would", "could", "should", "do", "does", "did", "can",
    }
    return {word for word in _normalize_words(question) if len(word) > 2 and word not in stop_words}


def _transcript_features(question: str, transcript: str, ideal_answer: str | None = None) -> dict:
    words = _normalize_words(transcript)
    token_count = len(words)
    unique_tokens = len(set(words))
    filler_terms = {
        "hi", "hello", "hey", "good", "morning", "evening", "thanks", "thank", "you", "um", "uh", "like",
        "basically", "literally", "actually", "well", "myself", "name", "is",
    }
    filler_count = sum(1 for word in words if word in filler_terms)
    filler_ratio = filler_count / token_count if token_count else 1.0

    q_terms = _question_terms(question)
    t_terms = set(words)
    overlap = len(q_terms & t_terms)
    overlap_ratio = overlap / max(len(q_terms), 1)

    ideal_terms = _question_terms(ideal_answer or "")
    ideal_overlap = len(ideal_terms & t_terms) if ideal_terms else 0
    ideal_ratio = ideal_overlap / max(len(ideal_terms), 1) if ideal_terms else 0.0

    relevance_score = max(overlap_ratio, ideal_ratio)
    structure_markers = sum(
        1 for marker in ("first", "second", "because", "for example", "therefore", "specifically")
        if marker in transcript.lower()
    )

    if token_count < 4:
        quality = "nonsense"
    elif filler_ratio >= 0.5 and token_count <= 12:
        quality = "filler"
    elif relevance_score < 0.12 or overlap == 0:
        quality = "weak"
    elif token_count < 45 or structure_markers == 0:
        quality = "partial"
    elif token_count < 90:
        quality = "strong"
    else:
        quality = "excellent"

    return {
        "quality": quality,
        "token_count": token_count,
        "unique_tokens": unique_tokens,
        "filler_count": filler_count,
        "filler_ratio": filler_ratio,
        "overlap": overlap,
        "overlap_ratio": overlap_ratio,
        "ideal_ratio": ideal_ratio,
        "relevance_score": relevance_score,
        "structure_markers": structure_markers,
    }


def _deterministic_low_score_feedback(reason: str, summary: str, technical: float = 0, communication: float = 0) -> dict:
    return {
        "technicalScore": _clamp_score(technical),
        "communicationScore": _clamp_score(communication),
        "confidenceScore": None,
        "overallScore": _clamp_score((technical * 0.85) + (communication * 0.15)),
        "feedback": {
            "summary": summary,
            "strengths": [],
            "weaknesses": ["Did not answer the question", "No technical concepts provided", reason],
            "missing_concepts": ["Core technical explanation", "Relevant concepts", "Question-specific reasoning"],
            "reasoning": reason,
        },
    }


def _apply_quality_guardrails(payload: dict, quality: dict) -> dict:
    caps = {
        "nonsense": {"technical": 0, "communication": 0, "overall": 1},
        "filler": {"technical": 0, "communication": 3, "overall": 2},
        "weak": {"technical": 20, "communication": 12, "overall": 18},
        "partial": {"technical": 48, "communication": 30, "overall": 44},
        "strong": {"technical": 82, "communication": 62, "overall": 80},
        "excellent": {"technical": 100, "communication": 85, "overall": 100},
    }

    cap = caps[quality["quality"]]
    technical = _clamp_score(payload.get("technicalScore", 0))
    communication = _clamp_score(payload.get("communicationScore", 0))
    feedback = payload.get("feedback") or {}

    if quality["quality"] in {"nonsense", "filler"}:
        return _deterministic_low_score_feedback(
            reason="The transcript was filler, irrelevant, or too short to evaluate meaningfully.",
            summary="The answer was irrelevant or contained only conversational filler.",
            technical=cap["technical"],
            communication=cap["communication"],
        )

    if quality["quality"] in {"weak", "partial"}:
        technical = min(technical, cap["technical"])
        communication = min(communication, cap["communication"])
    elif quality["quality"] == "strong":
        technical = max(min(technical, cap["technical"]), 55 if quality["relevance_score"] >= 0.45 else 45)
        communication = min(communication, cap["communication"])
    else:
        technical = max(min(technical, cap["technical"]), 75 if quality["relevance_score"] >= 0.6 else 65)
        communication = min(communication, cap["communication"])

    if quality["quality"] == "weak" and communication > 15:
        communication = 15
    if quality["quality"] == "partial" and communication > 35:
        communication = 35

    overall = (technical * 0.85) + (communication * 0.15)
    overall = min(overall, cap["overall"])

    feedback.setdefault("summary", "Answer evaluated with strict guardrails.")
    feedback.setdefault("strengths", [])
    feedback.setdefault("weaknesses", [])
    feedback.setdefault("missing_concepts", [])
    feedback.setdefault("reasoning", "")

    return {
        "technicalScore": _clamp_score(technical),
        "communicationScore": _clamp_score(communication),
        "confidenceScore": None,
        "overallScore": _clamp_score(overall),
        "feedback": feedback,
    }


async def _call_with_retry(prompt: str, max_tokens: int = 2000, temperature: float = 0.0) -> str:
    if not API_KEY:
        raise Exception("Missing GROQ_API_KEY.")
    if client is None:
        raise Exception("Missing openai dependency.")

    last_error: Optional[Exception] = None

    for model_name in MODEL_CHAIN:
        for attempt in range(MAX_RETRIES):
            try:
                logger.info(
                    "Groq call: model=%s attempt=%s/%s",
                    model_name,
                    attempt + 1,
                    MAX_RETRIES,
                )
                response = await asyncio.wait_for(
                    client.chat.completions.create(
                        model=model_name,
                        messages=[{"role": "user", "content": prompt}],
                        max_tokens=max_tokens,
                        temperature=temperature,
                        top_p=1,
                    ),
                    timeout=TIMEOUT_SECONDS,
                )
                return response.choices[0].message.content.strip()
            except asyncio.TimeoutError as e:
                last_error = e
                logger.warning("Groq timeout on %s (attempt %s)", model_name, attempt + 1)
            except Exception as e:
                last_error = e
                error_str = str(e)
                if "404" in error_str or "not found" in error_str.lower():
                    logger.warning("Model %s not available, trying next", model_name)
                    break
                is_rate_limit = "429" in error_str or "rate" in error_str.lower()
                if is_rate_limit:
                    delay = 2 ** attempt
                    logger.warning("Rate limited on %s, retrying in %ss", model_name, delay)
                    await asyncio.sleep(delay)
                else:
                    logger.error("Groq error on %s: %s", model_name, e)
                    break

    raise last_error or Exception("All retries and models exhausted")


async def analyze_resume_text(raw_text: str) -> ResumeAnalysisResult:
    prompt = (
        "You are an expert resume analyst and ATS system. "
        "Analyze the following resume text and return a JSON object with these EXACT fields:\n\n"
        "1. \"skills\": array of technical and soft skills found\n"
        "2. \"education\": array of objects with \"degree\", \"institution\", \"year\"\n"
        "3. \"experience\": array of objects with \"title\", \"company\", \"duration\", \"highlights\"\n"
        "4. \"projects\": array of objects with \"name\", \"description\", \"tech_stack\"\n"
        "5. \"tech_stack\": array of all technologies/tools mentioned\n"
        "6. \"ats_score\": number 0-100 rating the resume ATS compatibility\n"
        "7. \"feedback\": object with:\n"
        "   - \"summary\": brief overall assessment (string)\n"
        "   - \"strengths\": array of strong points\n"
        "   - \"weaknesses\": array of areas to improve\n"
        "   - \"suggestions\": array of specific improvement suggestions\n"
        "   - \"missing_keywords\": array of commonly expected keywords that are missing\n\n"
        "Resume Text:\n---\n"
        + raw_text[:5000]
        + "\n---\n\n"
        "Return ONLY valid JSON. No markdown, no code fences, no explanation."
    )

    text = await _call_with_retry(prompt)
    data = _parse_json(text)

    try:
        result = ResumeAnalysisResult.model_validate(data)
    except ValidationError as e:
        logger.error("Resume analysis validation failed: %s", e)
        raise

    result.ats_score = _clamp_score(result.ats_score)
    return result


async def generate_questions(job_role: str, interview_type: str, resume_text: str = None) -> List[dict]:
    resume_context = _parse_resume_context(resume_text)
    resume_keywords = _resume_keywords(resume_context)
    context_block = ""
    if resume_context:
        context_block = (
            "\nCandidate Resume Intelligence:\n"
            + json.dumps(resume_context, ensure_ascii=True)[:3000]
            + "\n"
        )

    interview_round = {
        "TECHNICAL": "backend engineering and deep technical screen",
        "HR": "recruiter screening and communication round",
        "DSA": "problem solving and coding round",
        "SYSTEM_DESIGN": "system design and architecture round",
        "MIXED": "realistic full-stack technical screen",
    }.get(interview_type, "realistic technical screen")

    prompt = (
        "You are a REALISTIC senior backend/SDE interviewer at a top tech company or startup (like Mercor, HireVue, etc.). "
        "Your objective is to conduct a rigorous, highly technical screening round. "
        "Write questions that sound like a real engineer who read the candidate's resume and wants to dig deep into their architecture, scaling, and production readiness. "
        "Generate EXACTLY 8 interview questions for a " + job_role + " position.\n"
        "Interview round: " + interview_round + "\n"
        "Rules:\n"
        "- ALL questions MUST be generated from the candidate's resume, projects, technologies used, architecture choices, deployment stack, etc.\n"
        "- The interview MUST naturally evolve through these 5 stages. Distribute the 8 questions across them:\n"
        "  Stage 1: Resume walkthrough and project overview\n"
        "  Stage 2: Architecture and implementation decisions\n"
        "  Stage 3: Debugging, scaling, concurrency, and bottlenecks\n"
        "  Stage 4: Production failures, monitoring, recovery, and deployment\n"
        "  Stage 5: Optimization, redesign, and tradeoff analysis\n"
        "- Ensure NO DUPLICATE topics. Each question must test a unique area.\n"
        "- Include realistic pressure in the question text, e.g., 'Why did you choose that?', 'What breaks if...?', 'How would you debug production failures...?'\n"
        "- FORBIDDEN QUESTIONS: Never ask generic theory, textbook prompts, HR filler, or random DSA. Do NOT ask 'What is Redis?', 'Explain DBMS', 'What is OOP?', etc.\n"
        "- Ask like a real interviewer who wants to verify ownership, depth, and honesty.\n"
        + context_block
        + "\nTarget resume entities and keywords to reference when relevant: "
        + (", ".join(resume_keywords[:30]) if resume_keywords else "none provided")
        + "\n\nReturn a JSON object with a single key \"questions\" containing an array of exactly 8 question objects.\n"
        "Each question object MUST include:\n"
        "- \"text\": the question text (string)\n"
        "- \"category\": one of TECHNICAL, HR, DSA, SYSTEM_DESIGN, BEHAVIORAL (string)\n"
        "- \"difficulty\": one of EASY, MEDIUM, HARD (string)\n"
        "- \"idealAnswer\": a brief ideal answer outline 2-3 sentences (string)\n\n"
        "Mix of difficulties: 2 EASY, 4 MEDIUM, 2 HARD.\n"
        "At least 5 questions must directly mention a project, technology, tool, architecture decision, or scaling claim from the resume when available.\n"
        "At least 3 questions must be follow-up / challenge questions that push deeper on the candidate's answer or project claims.\n"
        "Return ONLY valid JSON. No markdown, no code fences, no explanation."
    )

    text = await _call_with_retry(prompt, temperature=0.3)
    data = _parse_json(text)

    try:
        validated = QuestionGenerationResponse.model_validate(data)
    except ValidationError as e:
        logger.error("Question generation validation failed: %s", e)
        raise

    if len(validated.questions) != 8:
        raise ValueError(f"Expected 8 questions, got {len(validated.questions)}")

    if resume_keywords and sum(1 for q in validated.questions if any(keyword.lower() in q.text.lower() for keyword in resume_keywords)) < 4:
        validated = QuestionGenerationResponse.model_validate({
            "questions": _build_resume_fallback_questions(job_role, interview_type, resume_context, resume_keywords),
        })

    return [q.model_dump() for q in validated.questions]


def _pick_keywords(keywords: List[str], count: int = 4) -> List[str]:
    return keywords[:count]


def _build_resume_fallback_questions(job_role: str, interview_type: str, resume_context: dict[str, Any], resume_keywords: List[str]) -> List[dict]:
    project_names = _string_list(resume_context.get("projectNames"))
    technologies = _string_list(resume_context.get("technologies"))
    scaling_claims = _string_list(resume_context.get("scalingClaims"))
    queue_tools = _string_list(resume_context.get("queueTools"))
    database_tools = _string_list(resume_context.get("databaseTools"))
    websocket_tools = _string_list(resume_context.get("websocketTools"))
    monitoring_tools = _string_list(resume_context.get("monitoringTools"))
    deployment_tools = _string_list(resume_context.get("deploymentTools"))
    ai_tools = _string_list(resume_context.get("aiTools"))
    experience = _string_list(resume_context.get("experienceHighlights"))

    project = project_names[0] if project_names else job_role
    tech = technologies[0] if technologies else job_role
    queue_tool = queue_tools[0] if queue_tools else "queues"
    db_tool = database_tools[0] if database_tools else "PostgreSQL"
    ws_tool = websocket_tools[0] if websocket_tools else "WebSockets"
    monitor_tool = monitoring_tools[0] if monitoring_tools else "Prometheus"
    deploy_tool = deployment_tools[0] if deployment_tools else "Docker"
    ai_tool = ai_tools[0] if ai_tools else "AI evaluation"
    scaling_claim = scaling_claims[0] if scaling_claims else "scaling"
    experience_line = experience[0] if experience else "your recent work"
    keyword_sample = _pick_keywords(resume_keywords, 3)

    return [
        {
            "text": f"You mentioned {project}. Walk me through the hardest design decision you made there and what you would change today?",
            "category": "TECHNICAL",
            "difficulty": "EASY",
            "idealAnswer": f"A strong answer explains the project ownership, the tradeoff behind the chosen design, and one concrete improvement. It should reference {tech} or related stack details if relevant.",
        },
        {
            "text": f"Your resume calls out {queue_tool} and Redis. Why did you use them instead of synchronous execution, and what failure mode did they protect you from?",
            "category": "TECHNICAL",
            "difficulty": "EASY",
            "idealAnswer": "A strong answer explains asynchronous decoupling, Redis-backed queues, retries, backpressure, and why the workload should not block the request path.",
        },
        {
            "text": f"In {project}, how did {db_tool} support the data model, and which index or query path would you inspect first if latency spiked?",
            "category": "TECHNICAL",
            "difficulty": "MEDIUM",
            "idealAnswer": "A strong answer explains schema choices, read/write patterns, and the exact query or index that would be used to debug the bottleneck.",
        },
        {
            "text": f"You mentioned {ws_tool}. Explain how room membership or real-time sync works, and what breaks when you run more than one backend instance?",
            "category": "SYSTEM_DESIGN",
            "difficulty": "MEDIUM",
            "idealAnswer": "A strong answer covers room state, event propagation, reconnect behavior, and the scaling gap that appears without a shared adapter.",
        },
        {
            "text": f"Your resume mentions {monitor_tool}. Which metrics would you watch first to prove the system is healthy under load, and why?",
            "category": "TECHNICAL",
            "difficulty": "MEDIUM",
            "idealAnswer": "A strong answer names queue latency, active jobs, error rate, request latency, and saturation signals, then explains what each one tells you.",
        },
        {
            "text": f"You used {deploy_tool}, Redis, and background workers. If the worker restarts mid-job, how does recovery work and what data do you rely on to resume safely?",
            "category": "SYSTEM_DESIGN",
            "difficulty": "HARD",
            "idealAnswer": "A strong answer discusses idempotency, retry policy, durable state in Postgres/Redis, and how to avoid duplicate side effects.",
        },
        {
            "text": f"Explain how {ai_tool} was calibrated in your project. What kind of answers must be scored near zero, and how do you prevent inflated communication scores?",
            "category": "TECHNICAL",
            "difficulty": "HARD",
            "idealAnswer": "A strong answer talks about evaluation bands, guardrails, failure cases, and why model output alone is not trusted.",
        },
        {
            "text": f"What is the first production weakness you would call out in {experience_line}, and how would you defend that in an interview?",
            "category": "BEHAVIORAL",
            "difficulty": "MEDIUM",
            "idealAnswer": "A strong answer shows honest self-critique, concrete remediation, and awareness of the project’s current limits.",
        },
    ]

async def evaluate_answer(question: str, transcript: str, ideal_answer: str = None) -> dict:
    transcript = (transcript or "").strip()
    quality = _transcript_features(question, transcript, ideal_answer)

    if not transcript:
        return _deterministic_low_score_feedback(
            reason="The transcript was empty.",
            summary="No answer was provided.",
        )

    if quality["quality"] in {"nonsense", "filler"}:
        return _apply_quality_guardrails({}, quality)

    ideal_context = ""

    if ideal_answer:
        ideal_context = (
            "\nExpected Concepts / Ideal Answer:\n"
            + ideal_answer
            + "\n"
        )

    prompt = (
        "You are a STRICT, REALISTIC senior technical interviewer.\n"
        "Aggressively penalize vague answers, irrelevant content, filler, buzzwords, generic theory, and memorized definitions.\n"
        "Reward depth, debugging ability, architecture understanding, scalability reasoning, production awareness, concrete examples, and tradeoff analysis.\n"
        "Do not reward greetings or conversational speech. Use the FULL scoring range aggressively.\n\n"

        "Question:\n"
        + question
        + "\n"
        + ideal_context
        + "\nCandidate Answer Transcript:\n---\n"
        + transcript[:3000]
        + "\n---\n\n"

        "CRITICAL RULE:\n"
        "If the answer does not directly address the question,\n"
        "technicalScore MUST be between 0 and 15.\n\n"

        "SCORING CALIBRATION:\n"
        "- 0-10 = nonsense, filler, irrelevant, hallucinated, or completely wrong\n"
        "- 10-30 = weak and mostly incorrect\n"
        "- 30-50 = partially correct but shallow\n"
        "- 50-70 = reasonably correct but incomplete\n"
        "- 70-85 = strong technically correct answer\n"
        "- 85-100 = expert-level answer with depth and accuracy\n\n"

        "SCORING DIMENSIONS:\n"
        "1. technicalScore:\n"
        "- correctness\n"
        "- relevance\n"
        "- technical depth\n"
        "- concept accuracy\n"
        "- completeness\n\n"

        "2. communicationScore:\n"
        "- clarity\n"
        "- structure\n"
        "- readability\n"
        "- grammar\n"
        "- MUST remain below 20 if answer is irrelevant\n\n"

        "3. confidenceScore:\n"
        "- always null\n\n"

        "4. overallScore:\n"
        "- DO NOT calculate\n\n"

        "IMPORTANT:\n"
        "- Do NOT give safe middle scores.\n"
        "- Weak answers should score LOW.\n"
        "- Strong answers should score HIGH.\n"
        "- Greetings/filler should score near zero.\n\n"

        "Return ONLY valid JSON:\n"
        "{"
        '"technicalScore": <number>,'
        '"communicationScore": <number>,'
        '"confidenceScore": null,'
        '"feedback": {'
        '"summary": "<strict assessment>",'
        '"strengths": ["<string>"],'
        '"weaknesses": ["<string>"],'
        '"missing_concepts": ["<string>"],'
        '"reasoning": "<explicit transcript-based reasoning>"'
        "}"
        "}"
    )

    text = await _call_with_retry(prompt)

    data = _parse_json(text)

    try:
        validated = AnswerEvaluationResponse.model_validate(_apply_quality_guardrails({
            "technicalScore": _clamp_score(data["technicalScore"]),
            "communicationScore": _clamp_score(data["communicationScore"]),
            "confidenceScore": None,
            "overallScore": 0,
            "feedback": data["feedback"],
        }, quality))

    except (ValidationError, KeyError, TypeError) as e:
        logger.error(
            "Answer evaluation validation failed: %s | data=%s",
            e,
            data,
        )
        raise

    return validated.model_dump()


async def generate_followup(question: str, transcript: str, history: List[dict] = None) -> str | None:
    transcript = (transcript or "").strip()
    quality = _transcript_features(question, transcript)

    if quality["quality"] in {"nonsense", "filler", "weak"}:
        return None

    history_block = ""
    if history:
        history_text = "\n".join([f"Q: {h['question']}\nA: {h['answer']}" for h in history[-5:]])
        history_block = f"Previous Conversation Context:\n{history_text}\n\n"

    prompt = (
        "You are a strict, senior backend/SDE interviewer.\n"
        + history_block +
        "The candidate just answered this interview question:\n"
        f"Question: {question}\n"
        f"Transcript: {transcript}\n\n"
        "Generate EXACTLY ONE adaptive follow-up question that challenges their answer, asks for more technical depth, tradeoff analysis, or asks about a production failure mode based on what they just said.\n"
        "If they mentioned a specific technology (e.g., Redis, PostgreSQL, WebSockets), probe deeper into failure modes or limits of that technology.\n"
        "You can refer back to the Previous Conversation Context to point out contradictions or bring up earlier topics (e.g., 'You mentioned Redis earlier. What happens if...').\n"
        "The question must be dynamic, intelligent, and highly contextual.\n"
        "Do NOT acknowledge the previous answer (e.g., don't say 'Good answer' or 'Based on that'). Just ask the follow-up question directly.\n"
        "Return ONLY a JSON object with a single key \"followupText\" containing the question string.\n"
        "Return ONLY valid JSON. No markdown, no explanation."
    )

    try:
        text = await _call_with_retry(prompt, max_tokens=150)
        data = _parse_json(text)
        return data.get("followupText")
    except Exception as e:
        logger.error("Followup generation failed: %s", e)
        return None


async def _call_with_retry_messages(messages: List[dict], max_tokens: int = 500) -> str:
    """Chat completion with retry logic for conversational interviews."""
    if not API_KEY:
        raise Exception("Missing GROQ_API_KEY.")
    if client is None:
        raise Exception("Missing openai dependency.")

    last_error: Optional[Exception] = None

    for model_name in CONVERSATIONAL_MODEL_CHAIN:
        for attempt in range(MAX_RETRIES):
            try:
                logger.info(
                    "Groq chat call: model=%s attempt=%s/%s",
                    model_name,
                    attempt + 1,
                    MAX_RETRIES,
                )
                response = await asyncio.wait_for(
                    client.chat.completions.create(
                        model=model_name,
                        messages=messages,
                        max_tokens=max_tokens,
                        temperature=0.7,  # Slightly higher temperature for conversational responses
                        top_p=1,
                    ),
                    timeout=TIMEOUT_SECONDS,
                )
                return response.choices[0].message.content.strip()
            except asyncio.TimeoutError as e:
                last_error = e
                logger.warning("Groq timeout on %s (attempt %s)", model_name, attempt + 1)
            except Exception as e:
                last_error = e
                error_str = str(e)
                if "404" in error_str or "not found" in error_str.lower():
                    logger.warning("Model %s not available, trying next", model_name)
                    break
                is_rate_limit = "429" in error_str or "rate" in error_str.lower()
                if is_rate_limit:
                    # TPM window is per-minute; waiting a few seconds won't help.
                    # Fall through to the next (smaller/faster) model immediately.
                    logger.warning("Rate limited on %s, falling back to next model", model_name)
                    break
                else:
                    logger.error("Groq error on %s: %s", model_name, e)
                    break

    raise last_error or Exception("All retries and models exhausted")


async def chat_with_llm(messages: List[dict]) -> str:
    """Simple chat interface for conversational interviews."""
    return await _call_with_retry_messages(messages, max_tokens=500)