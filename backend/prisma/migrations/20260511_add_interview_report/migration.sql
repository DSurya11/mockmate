-- Add interview report JSON field

ALTER TABLE "interviews" ADD COLUMN IF NOT EXISTS "report" JSONB;

