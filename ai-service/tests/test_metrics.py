"""The agents' work shows up in /metrics: counts by outcome, never interview text."""

import asyncio
import json
from types import SimpleNamespace

from fastapi.testclient import TestClient
from prometheus_client import REGISTRY

from app.main import app
from app.services import interviewer


def _value(name, **labels):
    return REGISTRY.get_sample_value(name, labels) or 0.0


def test_interviewer_decisions_are_counted_and_served(monkeypatch):
    async def fake(messages, max_tokens=1000, temperature=0.0, timeout=None):
        return json.dumps({"action": "follow_up", "ack": "Got it.", "question": "Why that database?"})
    monkeypatch.setattr(interviewer.llm, "complete", fake)
    before = _value("mockmate_interviewer_actions_total", action="follow_up")
    request = SimpleNamespace(phase="CORE_QUESTIONS", interviewer_name="Priya", interviewer_title="Engineer",
                              interview_type="TECHNICAL", job_role="SRE", interviewer_tone="warm",
                              generated_questions=["Q1?", "Q2?"], question_index=1,
                              candidate_input="I picked Postgres for joins.", followups_used=0)
    asyncio.run(interviewer.decide(request))
    assert _value("mockmate_interviewer_actions_total", action="follow_up") == before + 1
    body = TestClient(app).get("/metrics/").text
    assert 'mockmate_interviewer_actions_total{action="follow_up"}' in body
    assert "Postgres" not in body                                      # no interview text, ever
