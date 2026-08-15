-- MP4 export job state on Job (separate from transcription).
-- Safe on Postgres (production). Applied via `npx prisma db push` or `prisma migrate deploy`.

ALTER TABLE "Job" ADD COLUMN IF NOT EXISTS "exportStatus" TEXT NOT NULL DEFAULT 'idle';
ALTER TABLE "Job" ADD COLUMN IF NOT EXISTS "exportProgress" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Job" ADD COLUMN IF NOT EXISTS "exportFilename" TEXT;
ALTER TABLE "Job" ADD COLUMN IF NOT EXISTS "exportError" TEXT;
ALTER TABLE "Job" ADD COLUMN IF NOT EXISTS "exportUrl" TEXT;
ALTER TABLE "Job" ADD COLUMN IF NOT EXISTS "exportKey" TEXT;
