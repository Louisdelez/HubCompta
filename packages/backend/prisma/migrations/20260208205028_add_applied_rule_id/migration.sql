-- AlterTable
ALTER TABLE "transactions" ADD COLUMN     "applied_rule_id" UUID;

-- CreateIndex
CREATE INDEX "transactions_applied_rule_id_idx" ON "transactions"("applied_rule_id");

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_applied_rule_id_fkey" FOREIGN KEY ("applied_rule_id") REFERENCES "rules"("id") ON DELETE SET NULL ON UPDATE CASCADE;
