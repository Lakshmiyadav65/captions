-- Prepaid caption minutes (never expire). Safe on Postgres (production).
-- Applied via `npx prisma db push` or `prisma migrate deploy`.

ALTER TABLE "Job" ADD COLUMN IF NOT EXISTS "creditReservedMin" DOUBLE PRECISION NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS "CreditBalance" (
    "userId" TEXT NOT NULL,
    "availableMinutes" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CreditBalance_pkey" PRIMARY KEY ("userId")
);

CREATE TABLE IF NOT EXISTS "CreditTransaction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "minutes" DOUBLE PRECISION NOT NULL,
    "balanceBefore" DOUBLE PRECISION NOT NULL,
    "balanceAfter" DOUBLE PRECISION NOT NULL,
    "paymentId" TEXT,
    "orderId" TEXT,
    "videoId" TEXT,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'COMPLETED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CreditTransaction_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "CreditPurchase" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "packId" TEXT NOT NULL,
    "minutes" DOUBLE PRECISION NOT NULL,
    "amount" INTEGER NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'inr',
    "paymentProvider" TEXT NOT NULL DEFAULT 'stripe',
    "paymentId" TEXT,
    "orderId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CreditPurchase_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "CreditPurchase_paymentId_key" ON "CreditPurchase"("paymentId");
CREATE UNIQUE INDEX IF NOT EXISTS "CreditPurchase_orderId_key" ON "CreditPurchase"("orderId");
CREATE INDEX IF NOT EXISTS "CreditTransaction_userId_createdAt_idx" ON "CreditTransaction"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "CreditTransaction_videoId_idx" ON "CreditTransaction"("videoId");
CREATE INDEX IF NOT EXISTS "CreditPurchase_userId_createdAt_idx" ON "CreditPurchase"("userId", "createdAt");

ALTER TABLE "CreditBalance" DROP CONSTRAINT IF EXISTS "CreditBalance_userId_fkey";
ALTER TABLE "CreditBalance"
  ADD CONSTRAINT "CreditBalance_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CreditTransaction" DROP CONSTRAINT IF EXISTS "CreditTransaction_userId_fkey";
ALTER TABLE "CreditTransaction"
  ADD CONSTRAINT "CreditTransaction_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CreditPurchase" DROP CONSTRAINT IF EXISTS "CreditPurchase_userId_fkey";
ALTER TABLE "CreditPurchase"
  ADD CONSTRAINT "CreditPurchase_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
