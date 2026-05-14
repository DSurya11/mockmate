import asyncio
import unittest
from unittest.mock import patch

from app.services.groq_service import (
    _apply_quality_guardrails,
    _build_resume_fallback_questions,
    _resume_keywords,
    _transcript_features,
    evaluate_answer,
)


class GroqServiceCalibrationTests(unittest.TestCase):
    def test_nonsense_answers_score_near_zero(self):
        result = asyncio.run(evaluate_answer("Explain cache invalidation", "hi hello thanks"))

        self.assertLessEqual(result["technicalScore"], 1)
        self.assertLessEqual(result["communicationScore"], 3)
        self.assertLessEqual(result["overallScore"], 2)

    def test_weak_answers_do_not_get_inflated_communication_scores(self):
        question = "Explain cache invalidation in a distributed system"
        transcript = "I would try to keep things simple and communicate the idea clearly."
        features = _transcript_features(question, transcript)
        scored = _apply_quality_guardrails(
            {
                "technicalScore": 88,
                "communicationScore": 92,
                "confidenceScore": None,
                "overallScore": 0,
                "feedback": {"summary": "", "strengths": [], "weaknesses": [], "missing_concepts": [], "reasoning": ""},
            },
            features,
        )

        self.assertEqual(features["quality"], "weak")
        self.assertLessEqual(scored["technicalScore"], 20)
        self.assertLessEqual(scored["communicationScore"], 15)
        self.assertLessEqual(scored["overallScore"], 18)

    def test_partial_answers_stay_below_strong_scores(self):
        question = "Describe how you would design a job queue"
        transcript = (
            "You would use a queue, retries, and a database for persistence. "
            "I would watch backlog, failures, and worker scaling."
        )
        features = _transcript_features(question, transcript)
        scored = _apply_quality_guardrails(
            {
                "technicalScore": 96,
                "communicationScore": 87,
                "confidenceScore": None,
                "overallScore": 0,
                "feedback": {"summary": "", "strengths": [], "weaknesses": [], "missing_concepts": [], "reasoning": ""},
            },
            features,
        )

        self.assertEqual(features["quality"], "partial")
        self.assertLessEqual(scored["technicalScore"], 48)
        self.assertLessEqual(scored["communicationScore"], 30)
        self.assertLessEqual(scored["overallScore"], 44)

    def test_strong_answers_can_score_high(self):
        question = "Explain cache invalidation in a distributed system"
        transcript = (
            "First, I would define cache ownership and invalidation boundaries. "
            "Then I would use explicit versioning, event-driven invalidation, and TTLs to reduce stale reads. "
            "For example, a write can publish a domain event so all replicas evict the key consistently. "
            "This balances correctness, latency, and operational simplicity."
        )
        features = _transcript_features(question, transcript)
        scored = _apply_quality_guardrails(
            {
                "technicalScore": 97,
                "communicationScore": 91,
                "confidenceScore": None,
                "overallScore": 0,
                "feedback": {"summary": "", "strengths": [], "weaknesses": [], "missing_concepts": [], "reasoning": ""},
            },
            features,
        )

        self.assertEqual(features["quality"], "strong")
        self.assertGreaterEqual(scored["technicalScore"], 75)
        self.assertGreaterEqual(scored["overallScore"], 65)

    def test_ai_failure_is_not_faked(self):
        async def boom(*args, **kwargs):
            raise RuntimeError("provider unavailable")

        question = "Explain cache invalidation in a distributed system"
        transcript = (
            "First, I would define cache ownership and invalidation boundaries. "
            "Then I would use explicit versioning and event-driven invalidation."
        )

        with patch("app.services.groq_service._call_with_retry", side_effect=boom):
            with self.assertRaises(RuntimeError):
                asyncio.run(evaluate_answer(question, transcript))

    def test_resume_fallback_questions_are_project_specific(self):
        resume_context = {
            "projectNames": ["MockMate AI Interview Platform"],
            "technologies": ["BullMQ", "Redis", "PostgreSQL", "Socket.IO", "Prometheus", "Docker"],
            "skills": ["TypeScript", "FastAPI", "System Design"],
            "queueTools": ["BullMQ"],
            "databaseTools": ["PostgreSQL"],
            "websocketTools": ["Socket.IO"],
            "monitoringTools": ["Prometheus"],
            "deploymentTools": ["Docker"],
            "aiTools": ["FastAPI", "Groq"],
            "scalingClaims": ["worker retries", "queue backpressure"],
            "experienceHighlights": ["realtime interview platform"],
        }

        keywords = _resume_keywords(resume_context)
        questions = _build_resume_fallback_questions(
            "Backend Engineer",
            "MIXED",
            resume_context,
            keywords,
        )

        joined = " ".join(question["text"] for question in questions)
        self.assertIn("BullMQ", joined)
        self.assertIn("Redis", joined)
        self.assertIn("PostgreSQL", joined)
        self.assertIn("Socket.IO", joined)
        self.assertIn("Prometheus", joined)
        self.assertIn("Docker", joined)
        self.assertEqual(len(questions), 8)
        self.assertGreaterEqual(sum(1 for question in questions if "?" in question["text"]), 8)


if __name__ == "__main__":
    unittest.main()