# MockMate — AI-Powered Mock Interview Platform

Full-stack AI interview platform with conversational voice interviewers, real-time transcription, resume analysis, and performance analytics.

## 🏗️ Architecture

```
Browser → Frontend (React 19 + TanStack) → Backend (Express + Prisma) → PostgreSQL
                                          ↓
                                    AI Service (FastAPI)
                                    ├── Groq LLM (conversation)
                                    ├── Piper TTS (voice synthesis)
                                    └── Faster-Whisper (transcription)
```

## 🚀 Tech Stack

**Frontend:** React 19, TanStack Start, Vite, TailwindCSS 4, shadcn/ui  
**Backend:** Node.js, Express 5, TypeScript, Prisma ORM  
**AI:** Python FastAPI, Groq LLM, Piper TTS, Faster-Whisper  
**Database:** PostgreSQL 16, Redis (BullMQ)  
**DevOps:** Docker Compose, GitHub Actions, Prometheus + Grafana

---

## � Quick Start

**Prerequisites:** Docker, Node.js v20+, [Groq API Key](https://console.groq.com/keys)

```bash
# Clone and setup
git clone https://github.com/DSurya11/mockmate.git
cd mockmate
node download_voices.js  # Downloads AI voice models

# Start all services
GROQ_API_KEY="your-key" docker compose up --build -d

# Access at http://localhost:3000
```

**Services:**
- Frontend: `http://localhost:3000`
- Backend API: `http://localhost:5000`
- Grafana: `http://localhost:3001` (admin/admin)

---

## ✨ Key Features

- **AI Conversational Interviewers** — 3 personas with unique voices & specialties (Groq LLM + Piper TTS)
- **Real-time Transcription** — Faster-Whisper for accurate speech-to-text
- **Resume Analysis** — PDF parsing, ATS scoring, skill extraction (BullMQ workers)
- **6 Interview Types** — Technical, Behavioral, System Design, HR, DSA, Mixed
- **Analytics Dashboard** — Performance trends, score breakdowns, interview history
- **Secure Auth** — JWT with HTTP-only cookies, refresh token rotation, RBAC
- **Production Monitoring** — Prometheus + Grafana metrics

---

## � Project Structure

```
├── frontend/          React 19 + TanStack Start + Vite
├── backend/           Express + TypeScript + Prisma ORM
├── ai-service/        FastAPI + Groq + Piper TTS + Whisper
├── monitoring/        Prometheus + Grafana
└── docker-compose.yml Full stack orchestration
```

---

## � Note

Voice model files (`voices/*.onnx`) are downloaded via `download_voices.js` and not committed to Git due to size constraints.
