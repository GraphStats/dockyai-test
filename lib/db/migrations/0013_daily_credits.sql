ALTER TABLE "User" ADD COLUMN "dailyCreditsRemaining" integer NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN "dailyCreditsResetAt" timestamp NOT NULL DEFAULT now();
