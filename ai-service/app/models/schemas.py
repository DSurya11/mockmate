from pydantic import BaseModel, Field
from typing import Optional, List, Literal

class ResumeAnalysisRequest(BaseModel):
    resumeId: str
    fileUrl: str
    fileName: str

class ResumeParsedData(BaseModel):
    skills: List[str] = []
    education: List[dict] = []
    experience: List[dict] = []
    projects: List[dict] = []
    tech_stack: List[str] = []

class ResumeFeedback(BaseModel):
    summary: str
    strengths: List[str] = []
    weaknesses: List[str] = []
    suggestions: List[str] = []
    missing_keywords: List[str] = []

class ResumeAnalysisResult(BaseModel):
    skills: List[str] = []
    education: List[dict] = []
    experience: List[dict] = []
    projects: List[dict] = []
    tech_stack: List[str] = []
    ats_score: float = Field(..., ge=0, le=100)
    feedback: ResumeFeedback

class ResumeAnalysisResponse(BaseModel):
    parsedData: ResumeParsedData
    rawText: str
    atsScore: float = Field(..., ge=0, le=100)
    aiFeedback: ResumeFeedback

class AnswerEvaluationRequest(BaseModel):
    answerId: str
    question: str
    transcript: str
    idealAnswer: Optional[str] = None

class AnswerFeedback(BaseModel):
    summary: str
    strengths: List[str] = []
    weaknesses: List[str] = []
    missing_concepts: List[str] = []
    reasoning: str

class AnswerEvaluationResponse(BaseModel):
    technicalScore: float = Field(..., ge=0, le=100)
    communicationScore: float = Field(..., ge=0, le=100)
    confidenceScore: Optional[float] = Field(default=None, ge=0, le=100)
    overallScore: float = Field(..., ge=0, le=100)
    feedback: AnswerFeedback

class QuestionGenerationRequest(BaseModel):
    interviewId: str
    jobRole: str
    type: str
    resumeText: Optional[str] = None

QuestionCategory = Literal["TECHNICAL", "HR", "DSA", "SYSTEM_DESIGN", "BEHAVIORAL"]
QuestionDifficulty = Literal["EASY", "MEDIUM", "HARD"]

class GeneratedQuestion(BaseModel):
    text: str
    category: QuestionCategory
    difficulty: QuestionDifficulty
    idealAnswer: Optional[str] = None

class QuestionGenerationResponse(BaseModel):
    questions: List[GeneratedQuestion]

class FollowupRequest(BaseModel):
    question: str
    transcript: str
    history: List[dict] = []
