"""Whisper with several Groq keys: the value "key1,key2" must never be sent as one key."""

import asyncio
from types import SimpleNamespace

import httpx
import pytest
from openai import APIStatusError

from app.routers import transcription


class FakeKey:
    def __init__(self, outcome):
        self.outcome, self.calls = outcome, 0
        self.audio = SimpleNamespace(transcriptions=self)

    async def create(self, **request):
        self.calls += 1
        if isinstance(self.outcome, int):
            response = httpx.Response(self.outcome, request=httpx.Request("POST", "https://api.groq.com"))
            raise APIStatusError("refused", response=response, body=None)
        return SimpleNamespace(text=self.outcome)


@pytest.fixture
def keys(monkeypatch):
    monkeypatch.setenv("GROQ_API_KEY", "first,second")
    monkeypatch.setattr(transcription, "_resting", {})
    fakes = {}
    monkeypatch.setattr(transcription, "_client", lambda number: fakes[number])
    return fakes


def test_each_key_is_used_on_its_own_and_a_refused_one_hands_over(keys):
    keys.update({0: FakeKey(401), 1: FakeKey("I would check the logs first.")})
    assert asyncio.run(transcription.whisper("a.webm", b"audio")) == "I would check the logs first."
    asyncio.run(transcription.whisper("a.webm", b"audio"))
    assert (keys[0].calls, keys[1].calls) == (1, 2)          # the refused key rests


def test_the_real_client_gets_one_key_not_the_whole_list(monkeypatch):
    monkeypatch.setenv("GROQ_API_KEY", "first,second")
    monkeypatch.setattr(transcription, "_clients", {})
    assert transcription._client(1).api_key == "second"


def test_when_every_key_fails_the_error_says_so(keys):
    keys.update({0: FakeKey(429), 1: FakeKey(500)})
    with pytest.raises(RuntimeError, match="key#1 HTTP 429; key#2 HTTP 500"):
        asyncio.run(transcription.whisper("a.webm", b"audio"))
