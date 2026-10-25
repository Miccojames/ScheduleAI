-- Attempt counter for the 6-digit verification code: a wrong guess increments
-- it, and at 5 the code is deleted (brute-force guard for the small keyspace).
ALTER TABLE "EmailVerificationToken" ADD COLUMN "attempts" INTEGER NOT NULL DEFAULT 0;
