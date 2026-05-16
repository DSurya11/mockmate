import { apiClient } from "./api-client";

type User = { id: string; name: string; email: string; role: string };
type Resume = {
  id: string;
  filename: string;
  uploadedAt: string;
  size: number;
  atsScore: number | null;
  status: "pending" | "analyzing" | "ready" | "error";
  summary?: string;
  skills?: string[];
  insights?: { strengths: string[]; gaps: string[] };
};
type Question = { 
  id: string; 
  prompt: string; 
  type: string; 
  answer?: { 
    transcript: string; 
    durationSeconds: number; 
    score?: number;
    aiFeedback?: any;
  } 
};
const TYPE_DISPLAY: Record<string, string> = {
  TECHNICAL: "Technical",
  HR: "HR",
  DSA: "DSA",
  SYSTEM_DESIGN: "System Design",
  BEHAVIORAL: "Behavioral",
  MIXED: "Mixed",
};

type Interview = {
  id: string;
  jobRole: string;
  interviewType: string;
  status: "scheduled" | "in_progress" | "completed" | "cancelled";
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  score?: number;
  questions: Question[];
};

export const api = {
  async register(input: { name: string; email: string; password: string }) {
    const data = await apiClient.post<any>('/auth/register', input);
    return { ok: true, user: data.user };
  },
  async login(input: { email: string; password: string }) {
    const data = await apiClient.post<{ user: User; accessToken: string }>('/auth/login', input);
    return { token: data.accessToken, user: data.user };
  },
  async me() {
    const data = await apiClient.get<{ user: User }>('/auth/me');
    return data.user;
  },
  logout() {
    apiClient.post('/auth/logout');
  },

  async getInterviews() {
    const data = await apiClient.get<any[]>('/interviews');
    return data.map(iv => ({
      id: iv.id,
      jobRole: iv.jobRole,
      interviewType: TYPE_DISPLAY[iv.type] ?? iv.type,
      status: iv.status.toLowerCase() as Interview["status"],
      createdAt: iv.createdAt,
      score: iv.totalScore,
      questions: iv.questions?.map((q: any) => ({
        id: q.id,
        prompt: q.questionText,
        type: q.category,
        answer: q.answer ? {
          transcript: q.answer.transcript,
          durationSeconds: q.answer.durationSeconds,
          score: q.answer.overallScore
        } : undefined
      })) || []
    }));
  },
  async getInterview(id: string) {
    const iv = await apiClient.get<any>(`/interviews/${id}`);
    return {
      id: iv.id,
      jobRole: iv.jobRole,
      interviewType: TYPE_DISPLAY[iv.type] ?? iv.type,
      status: iv.status.toLowerCase() as Interview["status"],
      createdAt: iv.createdAt,
      score: iv.totalScore,
      questions: iv.questions?.map((q: any) => ({
        id: q.id,
        prompt: q.questionText,
        type: q.category,
        answer: q.answer ? {
          transcript: q.answer.transcript,
          durationSeconds: q.answer.durationSeconds,
          score: q.answer.overallScore,
          aiFeedback: q.answer.aiFeedback
        } : undefined
      })) || []
    };
  },
  async createInterview(input: { jobRole: string; interviewType: string }) {
    const typeMap: Record<string, string> = {
      "Technical": "TECHNICAL",
      "Behavioral": "BEHAVIORAL",
      "System Design": "SYSTEM_DESIGN",
      "HR": "HR",
      "DSA": "DSA",
      "MIXED": "MIXED"
    };
    
    const backendType = typeMap[input.interviewType] || input.interviewType.toUpperCase();

    const data = await apiClient.post<any>('/interviews', {
      jobRole: input.jobRole,
      type: backendType
    });
    return { id: data.id };
  },
  async startInterview(id: string) {
    await apiClient.patch<any>(`/interviews/${id}/start`);
    return this.getInterview(id);
  },
  async cancelInterview(id: string) {
    await apiClient.patchWithOptions<any>(`/interviews/${id}/cancel`, undefined, {
      keepalive: true,
    });
    return this.getInterview(id);
  },
  async completeInterview(id: string) {
    await apiClient.patch<any>(`/interviews/${id}/complete`);
    return this.getInterview(id);
  },
  async submitAnswer(interviewId: string, questionId: string, payload: { transcript: string; durationSeconds: number }) {
    const data = await apiClient.post<any>(`/interviews/questions/${questionId}/answer`, payload);
    return { ok: true, score: data.overallScore };
  },

  async getResumes() {
    const data = await apiClient.get<any[]>('/resumes');
    return data.map(r => ({
      id: r.id,
      filename: r.fileName,
      size: r.fileSize,
      uploadedAt: r.uploadedAt,
      atsScore: r.atsScore,
      status: (r.atsScore !== null ? "ready" : r.aiFeedback?.status === "error" ? "error" : "pending") as Resume["status"],
      summary: r.aiFeedback?.summary || undefined,
      skills: r.parsedData?.tech_stack || r.parsedData?.skills || [],
      insights: r.aiFeedback ? {
        strengths: r.aiFeedback.strengths || [],
        gaps: r.aiFeedback.weaknesses || []
      } : undefined
    }));
  },
  async uploadResume(file: File) {
    const formData = new FormData();
    formData.append('resume', file);
    const r = await apiClient.post<any>('/resumes', formData);
    return {
      id: r.id,
      filename: r.fileName,
      size: r.fileSize,
      uploadedAt: r.uploadedAt,
      atsScore: r.atsScore,
      status: "pending"
    };
  },
  async analyzeResume(id: string) {
    return apiClient.post<any>(`/resumes/${id}/analyze`);
  },
  async deleteResume(id: string) {
    return apiClient.delete<any>(`/resumes/${id}`);
  },

  async candidateAnalytics() {
    const stats = await apiClient.get<any>('/analytics/candidate');
    const trendSource = stats.trend || stats.scoreHistory || [];
    return {
      totalInterviews: stats.totalInterviews,
      completedInterviews: stats.completedInterviews,
      averageScore: stats.averageScore,
      scoreBreakdown: Object.entries(stats.scoreBreakdown || {}).map(([label, value]) => ({
        label: label.charAt(0).toUpperCase() + label.slice(1),
        value: Math.round(value as number)
      })),
      trend: trendSource.map((t: any) => ({
        label: t.date || t.label,
        score: t.score
      })),
      recentInterviews: (stats.recentInterviews || []).map((iv: any) => ({
        id: iv.id,
        jobRole: iv.jobRole,
        status: iv.status.toLowerCase() as Interview["status"],
        score: iv.score,
        createdAt: iv.date || iv.createdAt
      })),
      strengths: stats.strengths || [],
      weakAreas: stats.weakAreas || []
    };
  },

  async getTtsAudioUrl(text: string, voice: string): Promise<string> {
    const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/tts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, voice }),
      credentials: 'include'
    });
    if (!res.ok) throw new Error('TTS failed');
    const blob = await res.blob();
    return URL.createObjectURL(blob);
  },

  async conversationalInterview(payload: {
    phase: string;
    interviewer_name: string;
    interviewer_title: string;
    interviewer_tone: string;
    interviewer_specialty: string;
    interview_type: string;
    job_role: string;
    candidate_name?: string;
    resume_summary?: string;
    candidate_field?: string;
    session_duration?: string;
    generated_questions?: string[];
    question_index?: number;
    conversation_history: Array<{role: string, content: string}>;
    candidate_input?: string;
    warmup_questions_asked?: number;
    exchange_count?: number;
  }) {
    const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/interviews/conversational`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      credentials: 'include'
    });
    if (!res.ok) throw new Error('Conversational interview failed');
    return res.json();
  },

  transcribeAudio: async (audioBlob: Blob): Promise<{ text: string; language?: string; duration?: number }> => {
    const formData = new FormData();
    formData.append('file', audioBlob, 'recording.webm');
    
    const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/transcribe/`, {
      method: 'POST',
      body: formData,
      credentials: 'include'
    });
    if (!res.ok) throw new Error('Transcription failed');
    return res.json();
  },
};

export type { User, Resume, Interview, Question };
