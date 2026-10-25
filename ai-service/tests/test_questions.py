"""Question generation without a resume: no question may claim facts only a resume could give."""

import asyncio
import json

from app.routers import interview
from app.services import groq_service, llm


def _questions(texts):
    return json.dumps({"questions": [{"text": t, "category": "TECHNICAL", "difficulty": "MEDIUM",
                                      "idealAnswer": "x"} for t in texts]})


def _model(monkeypatch, replies):
    prompts = []
    async def fake(prompt, max_tokens=1000, temperature=0.0):
        prompts.append(prompt)
        return replies[min(len(prompts) - 1, len(replies) - 1)]
    monkeypatch.setattr(groq_service, "_call_with_retry", fake)
    return prompts


CLEAN = [f"How would you design part {i} of a deployment pipeline?" for i in range(8)]
MADE_UP = ["Your resume mentions scaling Kafka to 2M msgs/sec. How did you size it?"] + CLEAN[1:]


def test_without_a_resume_the_prompt_forbids_resume_claims(monkeypatch):
    prompts = _model(monkeypatch, [_questions(CLEAN)])
    out = asyncio.run(groq_service.generate_questions("DevOps Engineer", "TECHNICAL", None))
    assert [q["text"] for q in out] == CLEAN
    assert "There is NO resume" in prompts[0] and "MUST be generated from the candidate's resume" not in prompts[0]


def test_a_made_up_resume_claim_is_asked_again_with_the_reason(monkeypatch):
    prompts = _model(monkeypatch, [_questions(MADE_UP), _questions(CLEAN)])
    out = asyncio.run(groq_service.generate_questions("DevOps Engineer", "TECHNICAL", None))
    assert len(prompts) == 2 and "Kafka" in prompts[1]
    assert [q["text"] for q in out] == CLEAN


def test_a_repeated_claim_is_replaced_by_a_role_question(monkeypatch):
    _model(monkeypatch, [_questions(MADE_UP)])
    out = asyncio.run(groq_service.generate_questions("DevOps Engineer", "TECHNICAL", None))
    assert len(out) == 8 and not any("resume" in q["text"].lower() for q in out)
    assert out[0]["text"].startswith("Pick a project you worked on")


def test_when_no_model_answers_the_greeting_is_scripted(monkeypatch):
    async def down(messages):
        raise llm.LLMUnavailable("all rate limited")
    monkeypatch.setattr(interview, "chat_with_llm", down)
    request = interview.ConversationalInterviewRequest(
        phase="GREETING", interviewer_name="Priya", interviewer_title="Senior Engineer",
        interviewer_tone="warm", interviewer_specialty="cloud", interview_type="TECHNICAL",
        job_role="DevOps Engineer")
    reply = asyncio.run(interview.conversational_interview(request))
    assert reply["response"].startswith("Hi, I'm Priya, Senior Engineer.")


def test_the_candidates_name_reaches_the_prompt(monkeypatch):
    # The prompt said {CANDIDATE_NAME | "the candidate"}, which the code never filled in, so the
    # interviewer never knew the name and asked for it in four turns in a row.
    seen = []
    async def capture(messages):
        seen.append(messages[0]["content"])
        return "Nice to meet you, Asha. How has your week been?"
    monkeypatch.setattr(interview, "chat_with_llm", capture)
    request = interview.ConversationalInterviewRequest(
        phase="SMALL_TALK", interviewer_name="Priya", interviewer_title="Senior Engineer",
        interviewer_tone="warm", interviewer_specialty="cloud", interview_type="TECHNICAL",
        job_role="DevOps Engineer", candidate_name="Asha", candidate_input="Doing well, thanks.")
    asyncio.run(interview.conversational_interview(request))
    assert "The candidate's name (if known): Asha" in seen[0]
    assert "{CANDIDATE_NAME" not in seen[0]
