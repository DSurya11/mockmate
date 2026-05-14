from fastapi import APIRouter, HTTPException
from app.models.schemas import AnswerEvaluationRequest
from app.services.groq_service import evaluate_answer

router = APIRouter()


@router.post("/answer")
async def evaluate_candidate_answer(request: AnswerEvaluationRequest):
    """Evaluate a candidate's answer using AI."""
    try:
        result = await evaluate_answer(
            question=request.question,
            transcript=request.transcript,
            ideal_answer=request.idealAnswer,
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"AI evaluation failed: {e}")
