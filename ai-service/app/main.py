from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import os

load_dotenv()

from app.routers import resume_router, evaluate_router, interview_router, tts, transcription

app = FastAPI(
    title="AI Interview Service",
    description="AI-powered resume analysis, question generation, and answer evaluation",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(resume_router, prefix="/api/resume", tags=["Resume"])
app.include_router(evaluate_router, prefix="/api/evaluate", tags=["Evaluation"])
app.include_router(interview_router, prefix="/api/interview", tags=["Interview"])
app.include_router(tts.router, prefix="/api")
app.include_router(transcription.router, prefix="/api")

@app.on_event("startup")
async def preload_whisper():
    """Pre-warm Whisper model at startup so the first transcription request is instant."""
    import asyncio
    import logging
    async def _warm():
        try:
            from app.routers.transcription import get_whisper_model
            await get_whisper_model()
            logging.info("Whisper model pre-warmed at startup.")
        except Exception as e:
            logging.warning(f"Whisper pre-warm failed (will retry on first request): {e}")
    asyncio.create_task(_warm())

@app.get("/health")
async def health():
    return {"status": "ok", "service": "ai-interview-ai-service"}

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("AI_SERVICE_PORT", "8000"))
    uvicorn.run("app.main:app", host="0.0.0.0", port=port, reload=True)
