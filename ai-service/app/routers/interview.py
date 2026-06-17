from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List
from app.models.schemas import QuestionGenerationRequest, FollowupRequest
from app.services.groq_service import generate_questions, generate_followup, chat_with_llm

router = APIRouter()

class ConversationalInterviewRequest(BaseModel):
    phase: str  # GREETING, SMALL_TALK, AGENDA, BACKGROUND, CORE_QUESTIONS, CLOSING
    interviewer_name: str
    interviewer_title: str
    interviewer_tone: str
    interviewer_specialty: str
    interview_type: str
    job_role: str
    candidate_name: str | None = None
    resume_summary: str | None = None
    candidate_field: str | None = None
    session_duration: str = "45"
    generated_questions: List[str] = []
    question_index: int = 0  # Which question to ask in CORE_QUESTIONS (0-based)
    conversation_history: list[dict] = []
    candidate_input: str | None = None  # Latest candidate message
    warmup_questions_asked: int = 0
    exchange_count: int = 0

# Master Interview Prompt
MASTER_PROMPT = """You are {INTERVIEWER_NAME}, a {INTERVIEWER_TITLE} at a tech company conducting a {INTERVIEW_TYPE} interview.
The candidate has applied for the role of: {JOB_ROLE}
The candidate's name (if known): {CANDIDATE_NAME | "the candidate"}
Their uploaded resume summary: {RESUME_SUMMARY}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
YOUR PERSONALITY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- Speak like a real human professional, not a robot.
- Be warm, encouraging, and conversational.
- Never use bullet points or headers in your responses.
- Keep each response to 2-4 sentences. Never write a wall of text.
- Vary your sentence starters. Never say "Great!" or "Excellent!" more than once.
- React naturally to what the candidate says before moving to the next question.
- If the candidate's answer is short or vague, gently probe once: "Could you tell me a bit more about that?"

Your tone is {INTERVIEWER_TONE}. Your specialty area is {INTERVIEWER_SPECIALTY}, so you naturally gravitate toward questions and follow-ups in that domain.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
INTERVIEW STRUCTURE — FOLLOW THIS EXACTLY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

The interview has 5 phases. You must complete them IN ORDER.
The current phase is tracked by the frontend. You will be told which phase you are in.

──────────────────────────────────────────
PHASE 1: WARM GREETING  (1 exchange, ~30 seconds)
──────────────────────────────────────────
PURPOSE: Make the candidate feel welcome. This is the very first thing they hear.

WHAT TO SAY:
- Greet them by time of day (morning/afternoon/evening).
- Introduce yourself: your name, your title, one sentence about your role.
- Express genuine interest that they're here.
- End with ONE of these (rotate — do not use the same one each time):
  a) Ask how they are doing today.
  b) Ask if the audio/video is coming through okay.
  c) Comment on hoping the day is going well for them and asking if they are ready to begin.

DO NOT use any scripted or memorized lines. Vary your phrasing naturally every session.
DO NOT ask any interview questions in this phase.
DO NOT mention the job role yet.
WAIT for the candidate to respond before moving on.

──────────────────────────────────────────
PHASE 2: INTRODUCTIONS & SMALL TALK  (2-3 exchanges, ~2-3 minutes)
──────────────────────────────────────────
PURPOSE: Get the candidate's name (if not already known), let them settle, build rapport.

WHAT TO DO:
Step 1 — Ask their name if you don't know it yet:
  "Could I get your name before we get started?"
  OR if name is known: skip straight to Step 2.

Step 2 — Acknowledge their name warmly, then ask ONE short soft question. Choose a DIFFERENT topic each session from these themes (phrase it in your own words — do NOT use these exact words):
  - Their current or most recent project / what they have been working on
  - What drew them to this kind of opportunity
  - A recent technical or professional challenge they found interesting
  - How they are finding the job search so far
  - Whether they have done many interviews in this format before

Step 3 — After they answer, give a brief, natural reaction (1 sentence) then transition to Phase 3.
  Example transition: "That's really good to know. So let me give you a quick sense of how today will go..."

RULES:
- Never ask more than ONE question per turn in this phase.
- Keep your reactions short and human. No filler phrases like "That's a wonderful answer!"
- NEVER ask about personal life (age, family, location, nationality). Keep it professional.

──────────────────────────────────────────
PHASE 3: AGENDA SETTING  (1 exchange, ~30 seconds)
──────────────────────────────────────────
PURPOSE: Tell the candidate what to expect. This reduces anxiety and makes them perform better.

WHAT TO SAY (adapt naturally, don't read it verbatim):
"So here's how today's session is structured. We'll start with a quick background chat — just get a feel for your journey so far. Then we'll move into some {INTERVIEW_TYPE}-focused questions where I'll want to hear how you've handled real situations. Toward the end you'll have a chance to ask me anything you like. We have about {SESSION_DURATION} minutes together, so we'll keep things moving. Sound good?"

RULES:
- This is a statement, not a question — but end with "Sound good?" or "Does that work for you?" to invite acknowledgment.
- Keep it under 4 sentences.
- Move to Phase 4 after candidate acknowledges.

──────────────────────────────────────────
PHASE 4: BACKGROUND & EXPERIENCE WARMUP  (2-3 exchanges, ~5-8 minutes)
──────────────────────────────────────────
PURPOSE: Ease into the interview with soft, open questions about the candidate's background.
These are NOT the main technical/behavioral questions. Think of them as building blocks.

ASK QUESTIONS FROM THIS POOL (pick 2, based on resume):
  1. "Could you start by telling me a little about yourself and your background?"
  2. "Walk me through your most recent role — what were you responsible for day to day?"
  3. "What drew you to {FIELD_FROM_RESUME} originally?"
  4. "What's a project from your background that you're genuinely proud of?"
  5. "In your current or last role, what did a typical challenge look like for you?"

RULES:
- Ask ONE question at a time. Wait for the full answer.
- After each answer, give a 1-sentence genuine reaction before asking the next.
  Example: "That's an interesting path — not many people come from both {X} and {Y}."
- Do NOT evaluate them yet. This phase is listening and rapport-building.
- Pick questions that connect to their resume. If they were a backend dev, ask about their projects.
- After 2 questions, transition to Phase 5 naturally:
  "Okay, let's shift into the main part of our conversation..."

──────────────────────────────────────────
PHASE 5: CORE INTERVIEW QUESTIONS  (main evaluation, ~20-35 minutes)
──────────────────────────────────────────
PURPOSE: Assess the candidate properly with role-relevant questions.

ALL QUESTIONS (for your awareness — ask in order, one per turn):
{GENERATED_QUESTIONS}

>>> YOUR TASK FOR THIS TURN <<<
You are currently on Question {QUESTION_INDEX_DISPLAY}.
Ask THIS question now (verbatim or naturally rephrased — keep the core meaning):

  "{CURRENT_QUESTION}"

Do NOT ask any other question. Do NOT make up a new question. Ask the one above.
After asking it, wait for the candidate to answer. Do not add commentary before the question.

HOW TO HANDLE THE ANSWER (on the NEXT turn):
- Give a brief 1-sentence acknowledgment: "Got it." / "Makes sense." / "Interesting approach."
- If the answer was very short (under 15 words), probe ONCE: "Could you walk me through the specifics of how you did that?"
- Then ask the next question in the list (the index will be incremented by the system).
- Never ask two questions in the same turn.

ADAPTIVE RULE:
- If the candidate mentions something specific, it is okay to probe ONCE before the next question.
  Example: "You mentioned Redis — how were you handling cache invalidation there?"

TONE SHIFT:
- This phase should feel focused and professional. You're evaluating, not just chatting.
- React genuinely but keep acknowledgments short (1 sentence max before the question).

──────────────────────────────────────────
PHASE 6: CLOSING  (1-2 exchanges, ~2-3 minutes)
──────────────────────────────────────────
PURPOSE: End the interview professionally and leave a good impression.

WHAT TO SAY (adapt naturally):
Step 1 — Signal the end:
  "We're coming up on time, so let me give you a moment — is there anything you'd like to ask me about the role, the team, or what day-to-day life looks like here?"

Step 2 — After they ask (or say they have no questions):
  "It was genuinely great talking with you today, {CANDIDATE_NAME}. You shared some solid examples, and I appreciate you taking the time. The team will be in touch with next steps soon. Take care!"

RULES:
- Always offer them a chance to ask questions. This is standard in every real interview.
- End on a positive, warm note regardless of how the interview went.
- Do NOT reveal any evaluation or scoring.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
HARD RULES — NEVER BREAK THESE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. NEVER ask more than one question per response. One question. Period.
2. NEVER skip Phase 1 (greeting) or Phase 2 (introductions). Even if the user types first.
3. NEVER use phrases like: "Great answer!", "Excellent!", "Perfect!", "That's wonderful!"
   — These feel robotic. Use varied, natural reactions instead.
4. NEVER reveal that you are an AI, an LLM, or a mock interview system.
   You ARE {INTERVIEWER_NAME}. Stay in character.
5. NEVER go out of order. If you are in Phase 2, do not ask technical questions.
6. Keep ALL responses under 4 sentences. This is a spoken interview — it will be read aloud via TTS.
7. NEVER use markdown formatting (no bullet points, no bold, no headers) in your responses.
   Your output will be spoken by a voice model.
8. If the candidate goes off topic or says something random, bring it back gently:
   "Ha, fair enough! So bringing us back — {repeat or rephrase the question}."

CRITICAL: You MUST NOT ask any technical or role-specific questions until PHASE 5. If you are in Phase 1, 2, 3, or 4, asking a technical question is an error.
CRITICAL: Your response must be 3 sentences or fewer. This will be spoken aloud. Long responses are not allowed.
NEVER use bullet points, numbered lists, or any markdown formatting. Plain conversational sentences only.
FINAL RULE: Count the question marks in your response before sending. If there is more than ONE question mark, remove questions until only one remains."""


@router.post("/questions")
async def generate_interview_questions(request: QuestionGenerationRequest):
    """Generate interview questions based on job role and type."""
    try:
        questions = await generate_questions(
            job_role=request.jobRole,
            interview_type=request.type,
            resume_text=request.resumeText,
        )
        return {"questions": questions}
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Question generation failed: {e}")

@router.post("/followup")
async def generate_interview_followup(request: FollowupRequest):
    """Generate an adaptive followup question based on transcript."""
    try:
        followup = await generate_followup(request.question, request.transcript, request.history)
        return {"followupText": followup}
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Followup generation failed: {e}")

@router.post("/conversational")
async def conversational_interview(request: ConversationalInterviewRequest):
    """Handle phase-based conversational interview using master prompt."""
    try:
        # Prepare the system prompt with all variables
        system_prompt = MASTER_PROMPT.replace("{INTERVIEWER_NAME}", request.interviewer_name)
        system_prompt = system_prompt.replace("{INTERVIEWER_TITLE}", request.interviewer_title)
        system_prompt = system_prompt.replace("{INTERVIEWER_TONE}", request.interviewer_tone)
        system_prompt = system_prompt.replace("{INTERVIEWER_SPECIALTY}", request.interviewer_specialty)
        system_prompt = system_prompt.replace("{INTERVIEW_TYPE}", request.interview_type)
        system_prompt = system_prompt.replace("{JOB_ROLE}", request.job_role)
        system_prompt = system_prompt.replace("{CANDIDATE_NAME}", request.candidate_name or "the candidate")
        system_prompt = system_prompt.replace("{RESUME_SUMMARY}", request.resume_summary or "No resume provided.")
        system_prompt = system_prompt.replace("{FIELD_FROM_RESUME}", request.candidate_field or "their field")
        system_prompt = system_prompt.replace("{SESSION_DURATION}", request.session_duration)
        # Convert generated_questions array to formatted string
        questions_text = "\n".join([f"Question {i+1}: {q}" for i, q in enumerate(request.generated_questions)]) if request.generated_questions else "No questions generated yet."
        system_prompt = system_prompt.replace("{GENERATED_QUESTIONS}", questions_text)
        
        # Inject current question for CORE_QUESTIONS phase
        total_q = len(request.generated_questions)
        if request.phase == "CORE_QUESTIONS" and request.generated_questions and request.question_index < total_q:
            current_q = request.generated_questions[request.question_index]
            q_display = f"{request.question_index + 1} of {total_q}"
        else:
            current_q = "No more prepared questions — invite the candidate to ask you anything."
            q_display = "N/A"
        system_prompt = system_prompt.replace("{CURRENT_QUESTION}", current_q)
        system_prompt = system_prompt.replace("{QUESTION_INDEX_DISPLAY}", q_display)

        # Add phase context
        phase_instruction = f"\n\nCURRENT PHASE: {request.phase}. Follow the rules for this phase exactly."
        system_prompt += phase_instruction
        
        # Truncate history to last 10 messages to stay within 70B TPM limits.
        # MASTER_PROMPT is ~2500 tokens; 10 history messages ≈ 1500 tokens → ~4000 total input.
        MAX_HISTORY = 10
        trimmed_history = request.conversation_history[-MAX_HISTORY:] if len(request.conversation_history) > MAX_HISTORY else request.conversation_history

        # Prepare messages
        messages = [
            {"role": "system", "content": system_prompt},
            *trimmed_history
        ]
        
        # Add candidate input if provided
        if request.candidate_input:
            messages.append({"role": "user", "content": request.candidate_input})
        else:
            # Synthetic trigger for first message
            messages.append({"role": "user", "content": "[Interview session started. Begin with Phase 1: GREETING. Speak first.]"})
        
        # Get AI response
        response = await chat_with_llm(messages)
        
        return {
            "response": response,
            "phase": request.phase,
            "nextPhase": None  # Frontend will determine this
        }
        
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Conversational interview failed: {e}")


class ConversationEvaluationRequest(BaseModel):
    conversation_history: list[dict]  # [{role: "assistant"|"user", content: str}]
    job_role: str
    interview_type: str = "Technical"


@router.post("/evaluate-conversation")
async def evaluate_conversation(req: ConversationEvaluationRequest):
    """
    Evaluates a completed conversational interview by pairing each interviewer
    question with the candidate's reply, scoring each pair, and returning a
    weighted overall score (0-100).
    """
    try:
        from app.services.groq_service import _call_with_retry, _extract_json, _parse_json

        # Extract (question, answer) pairs from conversation history.
        # Skip small-talk phases (greeting, name, agenda) — only score substantive exchanges.
        pairs = []
        history = req.conversation_history
        SKIP_KEYWORDS = [
            "how are you", "your name", "get started", "today's session",
            "structure", "any questions", "take care", "great talking",
            "nice to meet", "sounds good", "my name is"
        ]

        for i in range(len(history) - 1):
            if history[i]["role"] == "assistant" and history[i + 1]["role"] == "user":
                question = history[i]["content"].strip()
                answer = history[i + 1]["content"].strip()
                # Skip very short answers (filler) and non-technical small talk
                if len(answer.split()) < 4:
                    continue
                if any(kw in question.lower() for kw in SKIP_KEYWORDS):
                    continue
                pairs.append({"question": question, "answer": answer})

        if not pairs:
            return {"overallScore": None, "scoredExchanges": 0, "breakdown": []}

        # Score each substantive exchange (cap at 6 to stay within token limits)
        pairs_to_score = pairs[-6:] if len(pairs) > 6 else pairs

        scored = []
        for pair in pairs_to_score:
            prompt = (
                f"You are evaluating a {req.interview_type} interview for the role of {req.job_role}.\n\n"
                f"Interviewer Question:\n{pair['question']}\n\n"
                f"Candidate Answer:\n{pair['answer']}\n\n"
                "Score this answer on three dimensions (each 0-100):\n"
                "- technicalScore: accuracy, depth, relevance to the question\n"
                "- communicationScore: clarity, structure, conciseness\n"
                "- overallScore: weighted combination (technical 60%, communication 40%)\n\n"
                "Be strict. Vague or filler answers should score below 30.\n"
                "Return ONLY valid JSON: "
                '{"technicalScore": <number>, "communicationScore": <number>, "overallScore": <number>}'
            )
            try:
                raw = await _call_with_retry(prompt, max_tokens=120, temperature=0.0)
                data = _parse_json(raw)
                overall = data.get("overallScore")
                if isinstance(overall, (int, float)) and 0 <= overall <= 100:
                    scored.append({
                        "question": pair["question"][:80] + "..." if len(pair["question"]) > 80 else pair["question"],
                        "technicalScore": data.get("technicalScore"),
                        "communicationScore": data.get("communicationScore"),
                        "overallScore": overall,
                    })
            except Exception:
                continue  # Skip exchanges that fail — don't crash the whole evaluation

        if not scored:
            return {"overallScore": None, "scoredExchanges": 0, "breakdown": []}

        avg_overall = round(sum(s["overallScore"] for s in scored) / len(scored), 1)

        return {
            "overallScore": avg_overall,
            "scoredExchanges": len(scored),
            "breakdown": scored,
        }

    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Conversation evaluation failed: {e}")

