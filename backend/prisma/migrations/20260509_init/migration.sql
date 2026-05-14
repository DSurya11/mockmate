-- Initial PostgreSQL schema for AI Interview Evaluation Platform

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TYPE "UserRole" AS ENUM ('CANDIDATE', 'RECRUITER', 'ADMIN');
CREATE TYPE "InterviewStatus" AS ENUM ('SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');
CREATE TYPE "InterviewType" AS ENUM ('TECHNICAL', 'HR', 'DSA', 'SYSTEM_DESIGN', 'MIXED');
CREATE TYPE "QuestionCategory" AS ENUM ('TECHNICAL', 'HR', 'DSA', 'SYSTEM_DESIGN', 'BEHAVIORAL');
CREATE TYPE "QuestionDifficulty" AS ENUM ('EASY', 'MEDIUM', 'HARD');

CREATE TABLE "users" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "name" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "password_hash" TEXT NOT NULL,
  "role" "UserRole" NOT NULL DEFAULT 'CANDIDATE',
  "avatar_url" TEXT,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "resumes" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "file_name" TEXT NOT NULL,
  "file_url" TEXT NOT NULL,
  "file_size" INTEGER NOT NULL,
  "parsed_data" JSONB,
  "raw_text" TEXT,
  "ats_score" DOUBLE PRECISION,
  "ai_feedback" JSONB,
  "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "resumes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "sessions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "refresh_token_hash" TEXT NOT NULL,
  "user_agent" TEXT,
  "ip_address" TEXT,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "interviews" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "candidate_id" UUID NOT NULL,
  "recruiter_id" UUID,
  "job_role" TEXT NOT NULL,
  "type" "InterviewType" NOT NULL DEFAULT 'MIXED',
  "status" "InterviewStatus" NOT NULL DEFAULT 'SCHEDULED',
  "total_score" DOUBLE PRECISION,
  "score_breakdown" JSONB,
  "room_id" TEXT,
  "started_at" TIMESTAMP(3),
  "ended_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "interviews_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "questions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "interview_id" UUID NOT NULL,
  "question_text" TEXT NOT NULL,
  "category" "QuestionCategory" NOT NULL DEFAULT 'TECHNICAL',
  "difficulty" "QuestionDifficulty" NOT NULL DEFAULT 'MEDIUM',
  "order_num" INTEGER NOT NULL,
  "ideal_answer" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "questions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "answers" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "question_id" UUID NOT NULL,
  "transcript" TEXT,
  "audio_url" TEXT,
  "technical_score" DOUBLE PRECISION,
  "communication_score" DOUBLE PRECISION,
  "confidence_score" DOUBLE PRECISION,
  "overall_score" DOUBLE PRECISION,
  "ai_feedback" JSONB,
  "duration_seconds" INTEGER,
  "filler_word_count" INTEGER,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "answers_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "analytics" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "metrics" JSONB NOT NULL,
  "period_date" TIMESTAMP(3) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "analytics_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "audit_logs" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID,
  "action" TEXT NOT NULL,
  "resource" TEXT NOT NULL,
  "details" TEXT,
  "ip_address" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "resumes" ADD CONSTRAINT "resumes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "interviews" ADD CONSTRAINT "interviews_candidate_id_fkey" FOREIGN KEY ("candidate_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "interviews" ADD CONSTRAINT "interviews_recruiter_id_fkey" FOREIGN KEY ("recruiter_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "questions" ADD CONSTRAINT "questions_interview_id_fkey" FOREIGN KEY ("interview_id") REFERENCES "interviews"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "answers" ADD CONSTRAINT "answers_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "analytics" ADD CONSTRAINT "analytics_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
CREATE INDEX "resumes_user_id_idx" ON "resumes"("user_id");
CREATE UNIQUE INDEX "sessions_refresh_token_hash_key" ON "sessions"("refresh_token_hash");
CREATE INDEX "sessions_user_id_idx" ON "sessions"("user_id");
CREATE UNIQUE INDEX "interviews_room_id_key" ON "interviews"("room_id");
CREATE INDEX "interviews_candidate_id_idx" ON "interviews"("candidate_id");
CREATE INDEX "interviews_recruiter_id_idx" ON "interviews"("recruiter_id");
CREATE INDEX "interviews_status_idx" ON "interviews"("status");
CREATE INDEX "interviews_created_at_idx" ON "interviews"("created_at");
CREATE INDEX "questions_interview_id_idx" ON "questions"("interview_id");
CREATE UNIQUE INDEX "answers_question_id_key" ON "answers"("question_id");
CREATE UNIQUE INDEX "analytics_user_id_period_date_key" ON "analytics"("user_id", "period_date");
CREATE INDEX "analytics_user_id_idx" ON "analytics"("user_id");
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at");
