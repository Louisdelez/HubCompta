-- AddColumn
ALTER TABLE "budgets" ADD COLUMN "envelope_mode" BOOLEAN NOT NULL DEFAULT false;

-- AddColumn
ALTER TABLE "budgets" ADD COLUMN "rollover_enabled" BOOLEAN NOT NULL DEFAULT true;

-- AddColumn
ALTER TABLE "budgets" ADD COLUMN "rollover_amount" DECIMAL(19,4) NOT NULL DEFAULT 0;
