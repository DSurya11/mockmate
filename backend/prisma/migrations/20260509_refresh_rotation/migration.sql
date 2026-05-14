-- Add refresh rotation grace fields

ALTER TABLE "sessions" ADD COLUMN "previous_refresh_token_hash" TEXT;
ALTER TABLE "sessions" ADD COLUMN "rotated_at" TIMESTAMP(3);
