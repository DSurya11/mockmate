"""The voice chain against fake engines: which engine answers, when one rests, how text is cut."""

import asyncio
import io
import wave

import httpx
import pytest

from app.services import voice


def _wav(frames: int = 100) -> bytes:
    buf = io.BytesIO()
    with wave.open(buf, "wb") as w:
        w.setnchannels(1), w.setsampwidth(2), w.setframerate(24000)
        w.writeframes(b"\0\0" * frames)
    return buf.getvalue()


@pytest.fixture
def engines(monkeypatch):
    """Scripted engines: {"groq": status or None for audio, "aura": ..., "melo": ...}; records calls."""
    monkeypatch.setattr(voice, "_resting", {})
    monkeypatch.setenv("GROQ_API_KEY", "g1,g2")
    monkeypatch.setenv("CF_ACCOUNT_ID", "acct")
    monkeypatch.setenv("CF_API_TOKEN", "tok")
    script = {"groq": None, "aura": None, "melo": None}
    calls = []

    def handler(request: httpx.Request) -> httpx.Response:
        body = request.content.decode()
        if "groq.com" in request.url.host:
            calls.append(("orpheus", request.headers["authorization"][-2:], body))
            status = script["groq"]
            if isinstance(status, dict):
                status = status.get(request.headers["authorization"][-2:])
            return httpx.Response(status, text="refused") if status else httpx.Response(200, content=_wav())
        engine = "aura" if "aura" in request.url.path else "melo"
        calls.append((engine, "", body))
        status = script[engine]
        return httpx.Response(status, text="no") if status else httpx.Response(
            200, content=b"MP3", headers={"content-type": "audio/mpeg"})

    monkeypatch.setattr(voice, "_client", lambda: httpx.AsyncClient(transport=httpx.MockTransport(handler)))
    monkeypatch.setattr(voice, "_gtts", _fake_gtts)
    return script, calls


async def _fake_gtts(client, text, tld):
    return b"GTTS", "audio/mpeg"


def _speak(text="Thanks, that's a clear answer. What do you check first?", who="en_US-amy-low"):
    return asyncio.run(voice.speak(text, who))


def test_the_most_human_engine_answers_first_with_the_interviewers_own_voice(engines):
    script, calls = engines
    audio, media_type, engine = _speak()
    assert (engine, media_type) == ("orpheus", "audio/mpeg") and not audio.startswith(b"RIFF")
    assert '"voice":"autumn"' in calls[0][2].replace(" ", "")          # Sarah's Orpheus voice


def test_a_groq_key_that_refuses_hands_over_to_the_next_key_then_rests(engines):
    script, calls = engines
    script["groq"] = {"g1": 429}
    assert _speak()[2] == "orpheus"
    _speak()
    assert [c[1] for c in calls] == ["g1", "g2", "g2"]                 # g1 is not asked again


def test_terms_not_accepted_falls_back_to_aura_with_its_own_voice(engines):
    script, calls = engines
    script["groq"] = 400                                               # model_terms_required
    audio, media_type, engine = _speak(who="en_US-ryan-high")
    assert (engine, media_type, audio) == ("aura", "audio/mpeg", b"MP3")
    assert '"speaker":"helena"' in calls[-1][2].replace(" ", "")       # Priya's Aura voice


def test_with_every_cloud_engine_refusing_the_always_available_one_answers(engines):
    script, calls = engines
    script.update(groq=400, aura=429, melo=403)
    assert _speak()[2] == "gtts"
    calls.clear()
    assert _speak()[2] == "gtts"
    assert calls == []                                                 # all three are resting


def test_without_cloudflare_credentials_aura_and_melo_are_skipped(engines, monkeypatch):
    script, calls = engines
    monkeypatch.delenv("CF_API_TOKEN")
    script["groq"] = 429
    assert _speak()[2] == "gtts"
    assert {c[0] for c in calls} == {"orpheus"}


def test_long_text_is_cut_only_at_sentence_ends_and_wav_pieces_are_joined(engines):
    script, calls = engines
    long = "This is the first sentence of a long reply, which goes on. " * 6
    _, media_type, engine = _speak(long)
    assert (engine, media_type) == ("orpheus", "audio/mpeg") and len(calls) > 1
    assert all(len(c[2]) < 400 for c in calls)
    joined = voice._join_wav([_wav(100), _wav(100), _wav(100)])       # pieces joined before encoding
    with wave.open(io.BytesIO(joined)) as w:
        assert w.getnframes() == 300


def test_orpheus_wav_becomes_a_much_smaller_mp3_and_a_failed_encoding_keeps_the_wav(engines, monkeypatch):
    wav = _wav(24000)                                                 # one second of audio
    mp3 = voice._to_mp3(wav)
    assert len(mp3) * 4 < len(wav)
    monkeypatch.setattr(voice, "_to_mp3", lambda audio: (_ for _ in ()).throw(RuntimeError("encoder")))
    audio, media_type, _ = _speak()
    assert media_type == "audio/wav" and audio.startswith(b"RIFF")


def test_split_keeps_sentences_whole_and_cuts_long_ones_at_a_comma():
    text = "Thanks. That's a clear answer. Now, a production service starts timing out right after a deploy."
    assert voice.split(text, 100) == [text]                           # it fits: one request
    assert voice.split(text, 70) == ["Thanks. That's a clear answer.",
                                     "Now, a production service starts timing out right after a deploy."]
    long = "When the deploy finished, the error rate climbed, the pods restarted, and nobody had an alert."
    pieces = voice.split(long, 60)
    assert all(len(p) <= 60 for p in pieces) and " ".join(pieces) == long
    assert pieces[0].endswith(",")                                     # cut at a comma, not mid-phrase
