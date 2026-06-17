from fastapi import APIRouter, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel
from gtts import gTTS
import io

router = APIRouter()

# gTTS does not support named voices (those are Piper TTS format).
# We map each interviewer voice to a distinct regional accent via the tld parameter
# so Alex, Marcus, and Sarah sound audibly different.
VOICE_ACCENT_MAP = {
    "en_US-ryan-high":  "com",     # American accent  — Priya
    "en_US-joe-medium": "co.uk",   # British accent   — Jordan
    "en_US-amy-low":    "com.au",  # Australian accent — Sarah
}

class TTSRequest(BaseModel):
    text: str
    voice: str = "en_US-ryan-high"

@router.post("/tts")
async def synthesize(req: TTSRequest):
    try:
        tld = VOICE_ACCENT_MAP.get(req.voice, "com")
        tts = gTTS(text=req.text, lang='en', tld=tld, slow=False)

        buf = io.BytesIO()
        tts.write_to_fp(buf)
        buf.seek(0)

        return Response(content=buf.read(), media_type="audio/mpeg")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

