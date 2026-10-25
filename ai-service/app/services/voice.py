"""The interviewer's voice: the most human-sounding free engine that can answer right now.

Engines, best first (researched 2026-10-25):
  orpheus  Groq canopylabs/orpheus-v1-english. The most expressive; about 100 requests a day per
           Groq organisation, 200 characters a request, WAV only. Needs the terms accepted once
           in the Groq console; until then Groq answers 400 and it is skipped.
  aura     Cloudflare Workers AI, Deepgram Aura-2: made for voice agents. The free 10,000
           neurons a day buy about 3,600 characters. Needs CF_ACCOUNT_ID and CF_API_TOKEN.
  melo     Cloudflare Workers AI, MeloTTS: plainer, but costs almost nothing of that budget.
  gtts     Google Translate's voice: always there, least natural.

An engine that refuses (rate limit, quota, terms, bad credentials) rests for a while, so the
next line does not wait on it again. gTTS used to be fed whole replies and split them at every
comma ("Thanks" / "that's a clear answer" / "Now" / ...), each piece read on its own: that was
the stop-start sound. Text is now split only at sentence ends, and inside a sentence only when
an engine's length limit forces it.
"""

from __future__ import annotations

import asyncio
import base64
import io
import logging
import os
import re
import time
import wave

import httpx
import lameenc
from gtts import gTTS

from app.services import llm

logger = logging.getLogger(__name__)

# The frontend's voice ids (kept from the Piper days) -> a voice per engine. All three
# interviewers are women; each gets a different voice in every engine.
VOICES = {
    "en_US-ryan-high": {"orpheus": "diana", "aura": "helena", "gtts": "com"},      # Priya
    "en_US-joe-medium": {"orpheus": "hannah", "aura": "thalia", "gtts": "co.uk"},  # Jordan
    "en_US-amy-low": {"orpheus": "autumn", "aura": "andromeda", "gtts": "com.au"},  # Sarah
}
DEFAULT_VOICE = "en_US-ryan-high"
ORDER = ("orpheus", "aura", "melo", "gtts")
LIMITS = {"orpheus": 200, "aura": 1000, "melo": 500, "gtts": 100}
TIMEOUT_SECONDS = 12
REST_SECONDS = {"quota": 900, "refused": 3600}

CF_RUN = "https://api.cloudflare.com/client/v4/accounts/{account}/ai/run/{model}"
GROQ_SPEECH = "https://api.groq.com/openai/v1/audio/speech"

# engine (or "orpheus#2" for one Groq key) -> monotonic time it may be tried again
_resting: dict[str, float] = {}


class VoiceUnavailable(RuntimeError):
    pass


class _Refused(Exception):
    """This engine (or key) cannot answer for a while: rest it."""

    def __init__(self, reason: str, rest: float):
        super().__init__(reason)
        self.rest = rest


def split(text: str, limit: int) -> list[str]:
    """Pieces of at most `limit` characters, cut at sentence ends; inside a sentence only when
    it is longer than the limit, at the comma (else the space) nearest its middle."""
    sentences = [s.strip() for s in re.split(r"(?<=[.!?])\s+", text.strip()) if s.strip()]
    pieces: list[str] = []
    for sentence in sentences:
        pieces += _cut(sentence, limit)
    # Join neighbours that fit together: fewer requests, and the voice carries on naturally.
    joined: list[str] = []
    for piece in pieces:
        if joined and len(joined[-1]) + 1 + len(piece) <= limit:
            joined[-1] += " " + piece
        else:
            joined.append(piece)
    return joined


def _cut(sentence: str, limit: int) -> list[str]:
    if len(sentence) <= limit:
        return [sentence]
    middle = len(sentence) // 2
    commas = [m.end() for m in re.finditer(r"[,;:]\s", sentence)]
    spaces = [m.start() for m in re.finditer(r"\s", sentence)]
    at = min(commas or spaces or [middle], key=lambda i: abs(i - middle))
    return _cut(sentence[:at].strip(), limit) + _cut(sentence[at:].strip(), limit)


def _join_wav(parts: list[bytes]) -> bytes:
    if len(parts) == 1:
        return parts[0]
    out = io.BytesIO()
    with wave.open(io.BytesIO(parts[0])) as first, wave.open(out, "wb") as merged:
        merged.setparams(first.getparams())
        for part in parts:
            with wave.open(io.BytesIO(part)) as w:
                merged.writeframes(w.readframes(w.getnframes()))
    return out.getvalue()


def _to_mp3(wav: bytes) -> bytes:
    """Orpheus sends WAV: about 280 KB for one sentence. As 64 kbit/s MP3 it is about 8 times
    smaller, so it reaches the browser sooner, and the 30 MB Redis cache (set never to evict,
    which the job queues need) is not filled by voice lines. On any failure, the WAV is kept."""
    with wave.open(io.BytesIO(wav)) as source:
        channels, width, rate = source.getnchannels(), source.getsampwidth(), source.getframerate()
        frames = source.readframes(source.getnframes())
    if width != 2:
        return wav
    encoder = lameenc.Encoder()
    encoder.set_bit_rate(64)
    encoder.set_in_sample_rate(rate)
    encoder.set_channels(channels)
    encoder.set_quality(2)
    return bytes(encoder.encode(frames) + encoder.flush())


def _check(response: httpx.Response, engine: str) -> None:
    if response.status_code == 429:
        raise _Refused(f"{engine} rate-limited", REST_SECONDS["quota"])
    if response.status_code in (400, 401, 403):
        # Groq: terms not accepted (model_terms_required); Cloudflare: token or plan refused.
        raise _Refused(f"{engine} refused: HTTP {response.status_code} {response.text[:120]}",
                       REST_SECONDS["refused"])
    response.raise_for_status()


async def _orpheus(client: httpx.AsyncClient, text: str, voice: str) -> tuple[bytes, str]:
    keys = llm.keys("groq")
    if not keys:
        raise _Refused("no GROQ_API_KEY", REST_SECONDS["refused"])
    last: Exception | None = None
    for number, key in enumerate(keys, 1):
        name = f"orpheus#{number}"
        if _resting.get(name, 0) > time.monotonic():
            continue
        try:
            parts = []
            for piece in split(text, LIMITS["orpheus"]):
                response = await client.post(
                    GROQ_SPEECH, headers={"Authorization": f"Bearer {key}"},
                    json={"model": "canopylabs/orpheus-v1-english", "voice": voice,
                          "input": piece, "response_format": "wav"})
                _check(response, name)
                parts.append(response.content)
            audio = _join_wav(parts)
            try:
                return _to_mp3(audio), "audio/mpeg"
            except Exception as error:                       # never lose the voice over encoding
                logger.warning("MP3 encoding failed, sending WAV: %s", error)
                return audio, "audio/wav"
        except _Refused as error:
            _resting[name] = time.monotonic() + error.rest
            last = error
    raise last or _Refused("every Groq key is resting", REST_SECONDS["quota"])


def _cloudflare() -> tuple[str, str]:
    account, token = os.getenv("CF_ACCOUNT_ID"), os.getenv("CF_API_TOKEN")
    if not (account and token):
        raise _Refused("no CF_ACCOUNT_ID / CF_API_TOKEN", REST_SECONDS["refused"])
    return account, token


async def _aura(client: httpx.AsyncClient, text: str, voice: str) -> tuple[bytes, str]:
    account, token = _cloudflare()
    audio = b""
    for piece in split(text, LIMITS["aura"]):
        response = await client.post(
            CF_RUN.format(account=account, model="@cf/deepgram/aura-2-en"),
            headers={"Authorization": f"Bearer {token}"},
            json={"text": piece, "speaker": voice, "encoding": "mp3"})
        _check(response, "aura")
        if "json" in response.headers.get("content-type", ""):
            raise _Refused(f"aura answered JSON: {response.text[:120]}", REST_SECONDS["quota"])
        audio += response.content                 # MP3 frames join by concatenation
    return audio, "audio/mpeg"


async def _melo(client: httpx.AsyncClient, text: str, voice: str) -> tuple[bytes, str]:
    account, token = _cloudflare()
    audio = b""
    for piece in split(text, LIMITS["melo"]):
        response = await client.post(
            CF_RUN.format(account=account, model="@cf/myshell-ai/melotts"),
            headers={"Authorization": f"Bearer {token}"}, json={"prompt": piece, "lang": "en"})
        _check(response, "melo")
        if "json" in response.headers.get("content-type", ""):
            body = response.json()
            encoded = (body.get("result") or body).get("audio")
            if not encoded:
                raise _Refused(f"melo answered without audio: {response.text[:120]}", REST_SECONDS["quota"])
            audio += base64.b64decode(encoded)
        else:
            audio += response.content
    return audio, "audio/mpeg"


async def _gtts(client: httpx.AsyncClient, text: str, voice: str) -> tuple[bytes, str]:
    def run() -> bytes:
        buf = io.BytesIO()
        gTTS(text=text, lang="en", tld=voice, slow=False,
             tokenizer_func=lambda t: split(t, LIMITS["gtts"])).write_to_fp(buf)
        return buf.getvalue()
    return await asyncio.to_thread(run), "audio/mpeg"


def _client() -> httpx.AsyncClient:
    return httpx.AsyncClient(timeout=TIMEOUT_SECONDS)


ENGINES = {"orpheus": _orpheus, "aura": _aura, "melo": _melo, "gtts": _gtts}


async def speak(text: str, voice: str = DEFAULT_VOICE) -> tuple[bytes, str, str]:
    """(audio, media type, engine name) from the best engine that answers."""
    voices = VOICES.get(voice, VOICES[DEFAULT_VOICE])
    failures = []
    async with _client() as client:
        for engine in ORDER:
            if _resting.get(engine, 0) > time.monotonic():
                continue
            try:
                audio, media_type = await ENGINES[engine](client, text, voices.get(engine, ""))
                if audio:
                    return audio, media_type, engine
                failures.append(f"{engine}: empty audio")
            except _Refused as error:
                if engine != "orpheus":                 # orpheus rests per key, inside
                    _resting[engine] = time.monotonic() + error.rest
                failures.append(str(error))
            except Exception as error:                  # timeouts, outages: next engine, no rest
                failures.append(f"{engine}: {type(error).__name__}")
            logger.warning("Voice fallback: %s", failures[-1])
    raise VoiceUnavailable("; ".join(failures))
