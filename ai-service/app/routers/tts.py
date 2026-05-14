from fastapi import APIRouter, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel
from piper.voice import PiperVoice
import io, os, wave

router = APIRouter()

VOICE_DIR = os.getenv("VOICE_DIR", "/app/voices")
_voice_cache = {}

VALID_VOICES = [
    "en_US-ryan-high",
    "en_US-joe-medium",
    "en_US-amy-low",
]

def get_voice(voice_id: str) -> PiperVoice:
    if voice_id not in _voice_cache:
        model_path = os.path.join(VOICE_DIR, f"{voice_id}.onnx")
        if not os.path.exists(model_path):
            raise HTTPException(status_code=404, detail=f"Voice model not found: {voice_id}")
        _voice_cache[voice_id] = PiperVoice.load(model_path)
    return _voice_cache[voice_id]

class TTSRequest(BaseModel):
    text: str
    voice: str = "en_US-ryan-high"

@router.post("/tts")
async def synthesize(req: TTSRequest):
    if req.voice not in VALID_VOICES:
        raise HTTPException(status_code=400, detail=f"Unknown voice: {req.voice}")
    try:
        voice = get_voice(req.voice)
        audio_chunks = list(voice.synthesize(req.text))
        audio_bytes = b"".join(chunk.audio_int16_bytes for chunk in audio_chunks)
        buf = io.BytesIO()
        with wave.open(buf, "wb") as wav:
            wav.setnchannels(1)
            wav.setsampwidth(2)
            wav.setframerate(voice.config.sample_rate)
            wav.writeframes(audio_bytes)
        buf.seek(0)
        return Response(content=buf.read(), media_type="audio/wav")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
