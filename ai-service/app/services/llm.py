"""Every AI model call goes through here: a chain of free providers, tried in order.

A provider is skipped when its key is not set, so a Groq key alone is enough, and each extra
key (Mistral, OpenRouter, Gemini) is one more fallback when the others are rate-limited.
All of them speak the OpenAI chat format, so one client type serves every provider.

A provider's variable may hold several keys, comma-separated (GROQ_API_KEY=key1,key2). For each
model, every key is tried before moving to the next model: the best model is kept as long as
any key can still reach it. A key that was rate-limited on a model rests for a while (the
provider's Retry-After, else REST_SECONDS), so the next turn starts on a key that can answer
instead of waiting for the same 429 again. A rejected key (401/403) rests for every model; a
model that does not exist (404) rests for every key.

Order and models come from LLM_CHAIN ("provider:model,provider:model,..."). GROQ_MODEL_CHAIN is
no longer read: a stale value of it on Render kept the retired Llama models in use.
"""

from __future__ import annotations

import asyncio
import logging
import os
import time

from openai import (
    APIConnectionError,
    APIStatusError,
    APITimeoutError,
    AsyncOpenAI,
)

logger = logging.getLogger(__name__)

PROVIDERS = {
    "groq": ("https://api.groq.com/openai/v1", "GROQ_API_KEY"),
    "mistral": ("https://api.mistral.ai/v1", "MISTRAL_API_KEY"),
    "openrouter": ("https://openrouter.ai/api/v1", "OPENROUTER_API_KEY"),
    "gemini": ("https://generativelanguage.googleapis.com/v1beta/openai/", "GEMINI_API_KEY"),
}

# Measured 2026-10-25: gpt-oss-120b is the strongest free model on Groq and both gpt-oss models
# answer in well under a second with reasoning_effort "low". gemini-2.5-flash is closed to new
# keys (404) and gpt-oss-120b is no longer free on OpenRouter (404); the models below answered.
# Mistral's free tier allows 0 requests a minute on mistral-small and mistral-medium; the
# ministral models are open on it.
DEFAULT_CHAIN = (
    "groq:openai/gpt-oss-120b,groq:openai/gpt-oss-20b,gemini:gemini-3.5-flash,"
    "openrouter:nvidia/nemotron-3-ultra-550b-a55b:free,mistral:ministral-14b-latest,"
    "gemini:gemini-3.1-flash-lite"
)
TIMEOUT_SECONDS = float(os.getenv("LLM_TIMEOUT_SECONDS", "25"))
# gpt-oss "thinks" first and those tokens count against max_tokens: with 120 tokens,
# gpt-oss-20b spent 118 thinking and returned an empty reply. So: low effort plus headroom.
REASONING_HEADROOM = 400
REST_SECONDS = 30          # a rate-limited key rests this long when the provider gives no Retry-After
MAX_REST_SECONDS = 300
BAD_KEY_REST_SECONDS = 600


class LLMUnavailable(RuntimeError):
    """Every provider in the chain failed or has no key."""


class _EmptyReply(Exception):
    pass


_clients: dict[tuple[str, int], AsyncOpenAI] = {}
# (provider, key number, model) -> monotonic time it may be tried again. model "*" means every
# model of that key; key number -1 means every key for that model.
_resting: dict[tuple[str, int, str], float] = {}


def keys(provider: str) -> list[str]:
    """The provider's keys, in the order they are tried."""
    raw = os.getenv(PROVIDERS[provider][1]) or ""
    return [k.strip() for k in raw.split(",") if k.strip()]


def chain() -> list[tuple[str, str]]:
    """(provider, model) pairs to try, in order, keeping only providers with a key."""
    pairs = []
    # `or`, not a getenv default: docker compose passes an unset variable as an empty string.
    for item in (os.getenv("LLM_CHAIN") or DEFAULT_CHAIN).split(","):
        provider, _, model = item.strip().partition(":")
        if provider in PROVIDERS and model and keys(provider):
            pairs.append((provider, model))
    return pairs


def _client(provider: str, number: int) -> AsyncOpenAI:
    if (provider, number) not in _clients:
        # No SDK retries: a failing key hands over to the next one instead of waiting.
        _clients[(provider, number)] = AsyncOpenAI(
            api_key=keys(provider)[number], base_url=PROVIDERS[provider][0],
            timeout=TIMEOUT_SECONDS, max_retries=0)
    return _clients[(provider, number)]


def _rests_until(provider: str, number: int, model: str) -> float:
    return max(_resting.get((provider, number, model), 0), _resting.get((provider, number, "*"), 0),
               _resting.get((provider, -1, model), 0))


def _retry_after(error: APIStatusError) -> float:
    try:
        seconds = float(error.response.headers.get("retry-after", REST_SECONDS))
    except (TypeError, ValueError, AttributeError):
        seconds = REST_SECONDS
    return min(max(seconds, 1), MAX_REST_SECONDS)


def _attempts() -> list[tuple[str, str, int]]:
    """(provider, model, key number) in order: every key of the best model, then the next model.
    Resting ones go last instead of being dropped, in case every one of them is resting."""
    now = time.monotonic()
    ready, resting = [], []
    for provider, model in chain():
        for number in range(len(keys(provider))):
            (resting if _rests_until(provider, number, model) > now else ready).append((provider, model, number))
    return ready + resting


async def complete(messages: list[dict], max_tokens: int = 1000, temperature: float = 0.0,
                   timeout: float | None = None) -> str:
    """The first non-empty reply from the chain. Raises LLMUnavailable if none answers.

    timeout is per attempt: a spoken turn passes a short one, so a slow provider hands over to
    the next instead of holding the candidate in silence (one turn took 18 s in simulate.py)."""
    timeout = timeout or TIMEOUT_SECONDS
    attempts = _attempts()
    if not attempts:
        raise LLMUnavailable("no model provider key is set (GROQ_API_KEY at least)")
    failures = []
    for provider, model, number in attempts:
        label = f"{provider}:{model} key#{number + 1}"
        extra = {}
        limit = max_tokens
        if "gpt-oss" in model:
            extra["reasoning_effort"] = "low"
            limit = max_tokens + REASONING_HEADROOM
        try:
            response = await asyncio.wait_for(
                _client(provider, number).chat.completions.create(
                    model=model, messages=messages, max_tokens=limit, temperature=temperature,
                    **extra),
                timeout=timeout,
            )
            text = (response.choices[0].message.content or "").strip()
            if not text:
                raise _EmptyReply(f"finish_reason={response.choices[0].finish_reason}")
            logger.info("LLM reply from %s", label)
            return text
        except (asyncio.TimeoutError, APITimeoutError, APIConnectionError, _EmptyReply) as error:
            failures.append(f"{label} {type(error).__name__}")
        except APIStatusError as error:
            # 429 rate limit, 5xx outage, 404 retired model, 400 unsupported parameter:
            # all mean "this one cannot answer now", so the next one is tried.
            failures.append(f"{label} HTTP {error.status_code}")
            now = time.monotonic()
            if error.status_code == 429:
                _resting[(provider, number, model)] = now + _retry_after(error)
            elif error.status_code in (401, 403):
                _resting[(provider, number, "*")] = now + BAD_KEY_REST_SECONDS
            elif error.status_code == 404:
                _resting[(provider, -1, model)] = now + BAD_KEY_REST_SECONDS
        logger.warning("LLM fallback: %s", failures[-1])
    raise LLMUnavailable("every model provider failed: " + "; ".join(failures))
