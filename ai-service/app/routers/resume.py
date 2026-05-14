from fastapi import APIRouter, UploadFile, File, HTTPException
from app.models.schemas import ResumeAnalysisRequest
from app.services.groq_service import analyze_resume_text
from app.services.pdf_service import extract_text_from_pdf
import httpx
import os

router = APIRouter()

BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:5000")


@router.post("/analyze")
async def analyze_resume(request: ResumeAnalysisRequest):
    try:
        async with httpx.AsyncClient() as client:
            file_url = f"{BACKEND_URL}{request.fileUrl}"
            resp = await client.get(file_url)

            if resp.status_code != 200:
                raise HTTPException(status_code=404, detail="Resume file not found")

            file_bytes = resp.content

        try:
            raw_text = extract_text_from_pdf(file_bytes)
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))

        if not raw_text.strip():
            raise HTTPException(status_code=422, detail="Could not extract text from PDF")

        analysis = await analyze_resume_text(raw_text)

        return {
            "parsedData": {
                "skills": analysis.skills,
                "education": analysis.education,
                "experience": analysis.experience,
                "projects": analysis.projects,
                "tech_stack": analysis.tech_stack,
            },
            "rawText": raw_text[:10000],
            "atsScore": analysis.ats_score,
            "aiFeedback": analysis.feedback.model_dump(),
        }

    except HTTPException:
        raise

    except Exception as e:
        raise HTTPException(status_code=502, detail=f"AI resume analysis failed: {e}")


@router.post("/upload-analyze")
async def upload_and_analyze(file: UploadFile = File(...)):
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files supported")

    content = await file.read()

    try:
        raw_text = extract_text_from_pdf(content)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    if not raw_text.strip():
        raise HTTPException(status_code=422, detail="Could not extract text")

    try:
        analysis = await analyze_resume_text(raw_text)

    except Exception as e:
        raise HTTPException(status_code=502, detail=f"AI resume analysis failed: {e}")

    return {
        "parsedData": {
            "skills": analysis.skills,
            "education": analysis.education,
            "experience": analysis.experience,
            "projects": analysis.projects,
            "tech_stack": analysis.tech_stack,
        },
        "rawText": raw_text[:10000],
        "atsScore": analysis.ats_score,
        "aiFeedback": analysis.feedback.model_dump(),
    }