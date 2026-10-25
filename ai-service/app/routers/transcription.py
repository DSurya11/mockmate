from fastapi import APIRouter, UploadFile, File, HTTPException
import logging
import time
from pydantic import BaseModel
from typing import Optional
from openai import APIConnectionError, APIStatusError, APITimeoutError, AsyncOpenAI

from app.services import llm

class TranscriptionResponse(BaseModel):
    text: str
    language: Optional[str] = None
    duration: Optional[float] = None

router = APIRouter(prefix="/transcribe", tags=["transcription"])

# Groq Whisper, with every Groq key in GROQ_API_KEY ("key1,key2") tried in turn. Reading the
# variable as one key sent "key1,key2" to Groq once it held two: every answer came back empty.
# A key that is rate-limited or refused rests for a while, as in llm.py and voice.py.
REST_SECONDS = 120
TIMEOUT_SECONDS = 30
_clients: dict[int, AsyncOpenAI] = {}
_resting: dict[int, float] = {}


def _client(number: int) -> AsyncOpenAI:
    if number not in _clients:
        _clients[number] = AsyncOpenAI(base_url="https://api.groq.com/openai/v1",
                                       api_key=llm.keys("groq")[number],
                                       timeout=TIMEOUT_SECONDS, max_retries=0)
    return _clients[number]


async def whisper(filename: str, content: bytes) -> str:
    """The transcript from the first Groq key that answers. Raises RuntimeError if none does."""
    keys = llm.keys("groq")
    if not keys:
        raise RuntimeError("GROQ_API_KEY not set")
    now = time.monotonic()
    order = sorted(range(len(keys)), key=lambda n: _resting.get(n, 0) > now)   # resting keys last
    failures = []
    for number in order:
        try:
            result = await _client(number).audio.transcriptions.create(
                file=(filename, content), model="whisper-large-v3-turbo",
                language="en", response_format="json")
            return (result.text or "").strip()
        except APIStatusError as error:
            failures.append(f"key#{number + 1} HTTP {error.status_code}")
            if error.status_code in (401, 403, 429):
                _resting[number] = time.monotonic() + REST_SECONDS
        except (APITimeoutError, APIConnectionError) as error:
            failures.append(f"key#{number + 1} {type(error).__name__}")
        logging.warning("Whisper fallback: %s", failures[-1])
    raise RuntimeError("every Groq key failed: " + "; ".join(failures))


@router.post("/", response_model=TranscriptionResponse)
async def transcribe_audio(file: UploadFile = File(...)):
    """Transcribe audio using Groq Whisper API (whisper-large-v3-turbo).

    Groq processes audio at ~200x real-time (~631ms for a 5s clip).
    Supports webm, wav, mp3, ogg, flac natively — no ffmpeg conversion needed.
    """
    content_type = file.content_type or ""
    if not content_type.startswith(("audio/", "video/")):
        raise HTTPException(status_code=400, detail="Invalid file type. Expected audio or video.")

    try:
        content = await file.read()
        if not content:
            logging.warning("Empty audio file received")
            return TranscriptionResponse(text="", language="en", duration=0.0)

        filename = file.filename or "audio.webm"
        logging.info(f"Transcribing via Groq Whisper: {filename} ({len(content)} bytes)")
        text = await whisper(filename, content)
        logging.info(f"Groq transcription complete: '{text[:80]}'")
        return TranscriptionResponse(text=text, language="en", duration=None)

    except Exception as e:
        logging.error(f"Groq transcription error: {e}", exc_info=True)
        # Return empty transcript so the interview can continue unblocked
        return TranscriptionResponse(text="", language="en", duration=0.0)
