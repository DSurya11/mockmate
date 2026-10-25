"""The interviewer's decision against scripted model replies: the model decides, code enforces."""

import asyncio
import json
from types import SimpleNamespace

import pytest

from app.services import interviewer, llm

QUESTIONS = ["How did you deploy your platform?", "How would you debug a crash loop in production?"]


def _request(answer, index=1, followups=0):
    return SimpleNamespace(phase="CORE_QUESTIONS", interviewer_name="Priya", interviewer_title="Senior Engineer",
                           interview_type="TECHNICAL", job_role="DevOps Engineer", interviewer_tone="warm",
                           generated_questions=QUESTIONS, question_index=index, candidate_input=answer,
                           followups_used=followups)


def _model(monkeypatch, reply):
    async def fake(messages, max_tokens=1000, temperature=0.0, timeout=None):
        if isinstance(reply, Exception):
            raise reply
        return reply if isinstance(reply, str) else json.dumps(reply)
    monkeypatch.setattr(interviewer.llm, "complete", fake)


def _turn(request):
    return asyncio.run(interviewer.decide(request))


def test_next_always_asks_the_prepared_question_word_for_word(monkeypatch):
    _model(monkeypatch, {"action": "next", "ack": "Clear answer, thanks!", "question": "Something else?"})
    turn = _turn(_request("I used Helm charts on EKS with Argo CD syncing from Git."))
    assert turn == {"response": "Clear answer, thanks! How would you debug a crash loop in production?",
                    "phase": "CORE_QUESTIONS", "nextPhase": None, "action": "next", "advance": True}


def test_a_follow_up_stays_on_the_question_and_says_one_question(monkeypatch):
    _model(monkeypatch, {"action": "follow_up", "ack": "Interesting.",
                         "question": "How did you handle secrets? And what about rollbacks?"})
    turn = _turn(_request("I deployed it with some tools."))
    assert turn["advance"] is False and turn["action"] == "follow_up"
    assert turn["response"] == "Interesting. How did you handle secrets?"
    assert turn["response"].count("?") == 1


def test_follow_ups_stop_at_the_limit(monkeypatch):
    _model(monkeypatch, {"action": "follow_up", "ack": "Okay.", "question": "Why that tool?"})
    turn = _turn(_request("Because it was easy.", followups=interviewer.MAX_FOLLOWUPS))
    assert (turn["action"], turn["advance"]) == ("next", True)


@pytest.mark.parametrize("answer", ["Sorry, can you repeat that?", "I didn't understand the question",
                                    "Pardon?"])
def test_a_request_to_repeat_repeats_whatever_the_model_says(monkeypatch, answer):
    _model(monkeypatch, {"action": "next", "ack": "Great.", "question": ""})
    turn = _turn(_request(answer))
    assert turn == {"response": "Sure. How did you deploy your platform?", "phase": "CORE_QUESTIONS",
                    "nextPhase": None, "action": "repeat", "advance": False}


def test_markdown_and_a_question_in_the_acknowledgement_are_removed(monkeypatch):
    _model(monkeypatch, {"action": "next", "ack": "**Nice!** Why though?", "question": ""})
    assert _turn(_request("I used Terraform modules."))["response"].startswith("Nice!")


@pytest.mark.parametrize("reply", ["not json at all", llm.LLMUnavailable("all providers rate-limited")])
def test_a_broken_reply_or_an_outage_still_moves_the_interview_on(monkeypatch, reply):
    _model(monkeypatch, reply)
    turn = _turn(_request("My answer."))
    assert turn["response"] == "Thanks. How would you debug a crash loop in production?"
    assert turn["advance"] is True


def test_after_the_last_question_it_wraps_up(monkeypatch):
    _model(monkeypatch, {"action": "next", "ack": "Thank you.", "question": ""})
    turn = _turn(_request("Kubectl describe and logs, then the events.", index=2))
    assert turn["response"] == "Thank you. That covers my questions." and turn["advance"] is True


def test_a_follow_up_crediting_words_the_candidate_never_said_is_dropped(monkeypatch):
    # Measured: the model took Terraform from the next question and said "You mentioned Terraform".
    _model(monkeypatch, {"action": "follow_up", "ack": "You mentioned Terraform, nice.",
                         "question": "You mentioned using Terraform: how did you manage state?"})
    turn = _turn(_request("Argo CD syncs the Helm chart into EKS after GitHub Actions pushes the image."))
    assert turn["action"] == "next"
    assert turn["response"] == "Thanks. How would you debug a crash loop in production?"


def test_a_follow_up_about_what_was_said_is_kept(monkeypatch):
    _model(monkeypatch, {"action": "follow_up", "ack": "Got it.",
                         "question": "You mentioned Argo CD: what happens when a sync fails?"})
    turn = _turn(_request("Argo CD syncs the Helm chart into EKS after GitHub Actions pushes the image."))
    assert turn["action"] == "follow_up" and "Argo CD" in turn["response"]


def test_unasked_repeats_stop_at_the_follow_up_limit(monkeypatch):
    _model(monkeypatch, {"action": "repeat", "ack": "", "question": "How did you deploy it?"})
    assert _turn(_request("I like cricket.", followups=0))["action"] == "repeat"
    assert _turn(_request("I like cricket.", followups=2))["action"] == "next"
    # Asked for by the candidate, a repeat is always given.
    assert _turn(_request("Sorry, can you repeat that?", followups=2))["action"] == "repeat"
