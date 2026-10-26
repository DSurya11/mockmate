"""What the AI service's agents do, as Prometheus metrics (served at /metrics, shown in Grafana).

Counts only: no text of questions, answers or transcripts is ever recorded here.
"""

from prometheus_client import Counter, Histogram

LLM_CALLS = Counter(
    "mockmate_llm_calls_total", "Model calls by provider, model and outcome.",
    ["provider", "model", "outcome"])        # ok | rate_limited | refused | not_found | error | timeout | empty
LLM_SECONDS = Histogram(
    "mockmate_llm_seconds", "Time to a model's reply, answered calls only.", ["provider"],
    buckets=(0.25, 0.5, 1, 2, 4, 8, 16, 32))

INTERVIEWER_ACTIONS = Counter(
    "mockmate_interviewer_actions_total", "The interviewer's decision after each core answer.", ["action"])
INTERVIEWER_SECONDS = Histogram(
    "mockmate_interviewer_turn_seconds", "Time for the interviewer to decide a core-question turn.",
    buckets=(0.25, 0.5, 1, 2, 4, 8, 16))

VOICE_LINES = Counter("mockmate_voice_lines_total", "Spoken lines by the engine that spoke them.", ["engine"])
VOICE_FALLBACKS = Counter("mockmate_voice_fallbacks_total", "Voice engines passed over, and why.", ["engine", "reason"])

TRANSCRIPTIONS = Counter(
    "mockmate_transcriptions_total", "Answers transcribed, by outcome.", ["outcome"])   # text | silence | failed

EVALUATOR_QUOTES = Counter(
    "mockmate_evaluator_quotes_total", "Evidence quotes the evaluator gave: kept or rejected by code.", ["result"])
EVALUATOR_RUNS = Counter("mockmate_evaluator_runs_total", "Evaluations by status.", ["status"])
MANIPULATION = Counter(
    "mockmate_manipulation_attempts_total", "Candidate sentences addressed to the grader, excluded from scoring.")
