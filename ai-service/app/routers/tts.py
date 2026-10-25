from fastapi import APIRouter, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel

from app.services import voice

router = APIRouter()


class TTSRequest(BaseModel):
    text: str
    voice: str = voice.DEFAULT_VOICE


@router.post("/tts")
async def synthesize(req: TTSRequest):
    """The interviewer's line as audio, from the most natural engine that can answer now.
    X-Voice-Engine says which one, so the backend caches only the good ones."""
    try:
        audio, media_type, engine = await voice.speak(req.text, req.voice)
    except voice.VoiceUnavailable as error:
        raise HTTPException(status_code=503, detail=str(error))
    return Response(content=audio, media_type=media_type, headers={"X-Voice-Engine": engine})
