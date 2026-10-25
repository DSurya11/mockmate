"""The provider chain against fake providers: free, and the same result every run."""

import asyncio
from types import SimpleNamespace

import httpx
import pytest
from openai import RateLimitError

from app.services import llm


def _reply(text, finish="stop"):
    return SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(content=text),
                                                    finish_reason=finish)])


class FakeProvider:
    """Stands in for one provider's client: answers from a script, records every request."""

    def __init__(self, outcome):
        self.outcome, self.requests = outcome, []
        self.chat = SimpleNamespace(completions=self)

    async def create(self, **request):
        self.requests.append(request)
        if isinstance(self.outcome, Exception):
            raise self.outcome
        return self.outcome


def _rate_limited():
    response = httpx.Response(429, request=httpx.Request("POST", "https://api.groq.com/openai/v1"))
    return RateLimitError("rate limited", response=response, body=None)


@pytest.fixture
def providers(monkeypatch):
    for _, key in llm.PROVIDERS.values():
        monkeypatch.delenv(key, raising=False)
    monkeypatch.setenv("LLM_CHAIN", "groq:openai/gpt-oss-120b,mistral:mistral-small-latest,gemini:gemini-2.5-flash")
    monkeypatch.setattr(llm, "_resting", {})
    fakes = {}
    # "groq" stands in for every Groq key; "groq#2" for the second key only.
    monkeypatch.setattr(llm, "_client",
                        lambda provider, number: fakes.get(f"{provider}#{number + 1}") or fakes[provider])
    return fakes


def test_providers_without_a_key_are_skipped(providers, monkeypatch):
    monkeypatch.setenv("GROQ_API_KEY", "g")
    monkeypatch.setenv("GEMINI_API_KEY", "m")
    assert llm.chain() == [("groq", "openai/gpt-oss-120b"), ("gemini", "gemini-2.5-flash")]


def test_rate_limits_timeouts_and_empty_replies_move_to_the_next_provider(providers, monkeypatch):
    for key in ("GROQ_API_KEY", "MISTRAL_API_KEY", "GEMINI_API_KEY"):
        monkeypatch.setenv(key, "k")
    providers.update(groq=FakeProvider(_rate_limited()),
                     mistral=FakeProvider(_reply("", finish="length")),
                     gemini=FakeProvider(_reply("hello")))
    assert asyncio.run(llm.complete([{"role": "user", "content": "hi"}])) == "hello"
    assert [len(p.requests) for p in providers.values()] == [1, 1, 1]


def test_gpt_oss_gets_low_effort_and_room_to_think(providers, monkeypatch):
    monkeypatch.setenv("GROQ_API_KEY", "k")
    providers["groq"] = FakeProvider(_reply("ok"))
    asyncio.run(llm.complete([{"role": "user", "content": "hi"}], max_tokens=120))
    request = providers["groq"].requests[0]
    assert request["reasoning_effort"] == "low"
    assert request["max_tokens"] == 120 + llm.REASONING_HEADROOM


def test_when_every_provider_fails_the_error_says_which_and_why(providers, monkeypatch):
    monkeypatch.setenv("GROQ_API_KEY", "k")
    providers["groq"] = FakeProvider(_rate_limited())
    with pytest.raises(llm.LLMUnavailable, match="groq:openai/gpt-oss-120b key#1 HTTP 429"):
        asyncio.run(llm.complete([{"role": "user", "content": "hi"}]))


def test_no_key_at_all_is_a_clear_error(providers):
    with pytest.raises(llm.LLMUnavailable, match="GROQ_API_KEY"):
        asyncio.run(llm.complete([{"role": "user", "content": "hi"}]))


def test_an_empty_chain_setting_means_the_default_chain(monkeypatch):
    monkeypatch.setenv("LLM_CHAIN", "")                  # what docker compose passes when unset
    monkeypatch.setenv("GROQ_API_KEY", "k")
    assert llm.chain()[0] == ("groq", "openai/gpt-oss-120b")


def test_a_slow_provider_hands_over_within_the_turn_timeout(providers, monkeypatch):
    for key in ("GROQ_API_KEY", "MISTRAL_API_KEY"):
        monkeypatch.setenv(key, "k")

    class Slow(FakeProvider):
        async def create(self, **request):
            await asyncio.sleep(5)

    providers.update(groq=Slow(None), mistral=FakeProvider(_reply("fast")))
    assert asyncio.run(llm.complete([{"role": "user", "content": "hi"}], timeout=0.05)) == "fast"


def _status(code):
    from openai import APIStatusError
    response = httpx.Response(code, request=httpx.Request("POST", "https://api.groq.com/openai/v1"),
                              headers={"retry-after": "45"} if code == 429 else {})
    return APIStatusError(f"HTTP {code}", response=response, body=None)


class ByModel(FakeProvider):
    """One key: a different outcome per model."""

    async def create(self, **request):
        self.requests.append(request["model"])
        outcome = self.outcome.get(request["model"], _status(429))
        if isinstance(outcome, Exception):
            raise outcome
        return outcome


@pytest.fixture
def two_groq_keys(providers, monkeypatch):
    monkeypatch.setenv("GROQ_API_KEY", "first, second")
    monkeypatch.setenv("LLM_CHAIN", "groq:openai/gpt-oss-120b,groq:openai/gpt-oss-20b")
    return providers


def test_every_key_is_tried_on_the_best_model_before_the_next_model(two_groq_keys):
    two_groq_keys["groq#1"] = ByModel({"openai/gpt-oss-20b": _reply("small")})
    two_groq_keys["groq#2"] = ByModel({"openai/gpt-oss-120b": _reply("big")})
    assert llm.keys("groq") == ["first", "second"]
    assert asyncio.run(llm.complete([{"role": "user", "content": "hi"}])) == "big"
    assert two_groq_keys["groq#1"].requests == ["openai/gpt-oss-120b"]   # then key 2, same model


def test_a_rate_limited_key_rests_so_the_next_call_starts_on_the_other(two_groq_keys):
    two_groq_keys["groq#1"] = ByModel({})                                # 429 on everything
    two_groq_keys["groq#2"] = ByModel({"openai/gpt-oss-120b": _reply("big")})
    asyncio.run(llm.complete([{"role": "user", "content": "hi"}]))
    asyncio.run(llm.complete([{"role": "user", "content": "hi"}]))
    assert two_groq_keys["groq#1"].requests == ["openai/gpt-oss-120b"]   # not asked again
    assert llm._rests_until("groq", 0, "openai/gpt-oss-120b") > 0      # for its Retry-After


def test_when_every_key_is_resting_they_are_still_tried(two_groq_keys):
    two_groq_keys["groq"] = ByModel({})
    for _ in range(2):
        with pytest.raises(llm.LLMUnavailable):
            asyncio.run(llm.complete([{"role": "user", "content": "hi"}]))
    assert len(two_groq_keys["groq"].requests) == 8                     # 2 keys x 2 models, twice


def test_a_rejected_key_rests_for_every_model_and_a_missing_model_for_every_key(two_groq_keys):
    two_groq_keys["groq#1"] = ByModel({"openai/gpt-oss-120b": _status(401)})
    two_groq_keys["groq#2"] = ByModel({"openai/gpt-oss-120b": _status(404), "openai/gpt-oss-20b": _reply("ok")})
    asyncio.run(llm.complete([{"role": "user", "content": "hi"}]))
    order = [(p, m, n) for p, m, n in llm._attempts()]
    assert order[0] == ("groq", "openai/gpt-oss-20b", 1)                # the only one not resting
