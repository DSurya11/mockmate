from fastapi import APIRouter, UploadFile, File, HTTPException
import os
import logging
from pydantic import BaseModel
from typing import Optional
from openai import OpenAI

class TranscriptionResponse(BaseModel):
    text: str
    language: Optional[str] = None
    duration: Optional[float] = None

router = APIRouter(prefix="/transcribe", tags=["transcription"])

# Groq Whisper client — reuses GROQ_API_KEY, OpenAI-compatible endpoint
_groq_client: Optional[OpenAI] = None

def get_groq_client() -> OpenAI:
    global _groq_client
    if _groq_client is None:
        api_key = os.getenv("GROQ_API_KEY")
        if not api_key:
            raise RuntimeError("GROQ_API_KEY not set")
        _groq_client = OpenAI(
            base_url="https://api.groq.com/openai/v1",
            api_key=api_key,
        )
    return _groq_client


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

        client = get_groq_client()
        result = client.audio.transcriptions.create(
            file=(filename, content),
            model="whisper-large-v3-turbo",
            language="en",
            response_format="json",
        )

        text = (result.text or "").strip()
        logging.info(f"Groq transcription complete: '{text[:80]}'")
        return TranscriptionResponse(text=text, language="en", duration=None)

    except Exception as e:
        logging.error(f"Groq transcription error: {e}", exc_info=True)
        # Return empty transcript so the interview can continue unblocked
        return TranscriptionResponse(text="", language="en", duration=0.0)
