CREATE TABLE IF NOT EXISTS "ModelUsageLedger" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "userId" varchar(255) NOT NULL,
  "modelId" varchar(255) NOT NULL,
  "coinsCharged" integer NOT NULL,
  "hfCostMicrosEur" integer NOT NULL DEFAULT 0,
  "createdAt" timestamp NOT NULL
);

DO $$ BEGIN
  ALTER TABLE "ModelUsageLedger"
  ADD CONSTRAINT "ModelUsageLedger_userId_User_id_fk"
  FOREIGN KEY ("userId") REFERENCES "public"."User"("id")
  ON DELETE no action ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
