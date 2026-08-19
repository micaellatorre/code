ALTER TABLE "CustomerOrder"
  ADD COLUMN IF NOT EXISTS "appointmentId" TEXT,
  ADD COLUMN IF NOT EXISTS "customerNameSnapshot" TEXT,
  ADD COLUMN IF NOT EXISTS "customerDocumentSnapshot" TEXT,
  ADD COLUMN IF NOT EXISTS "customerPhoneSnapshot" TEXT,
  ADD COLUMN IF NOT EXISTS "customerEmailSnapshot" TEXT,
  ADD COLUMN IF NOT EXISTS "deliveryDisclaimerSnapshot" TEXT;

CREATE INDEX IF NOT EXISTS "CustomerOrder_appointmentId_idx" ON "CustomerOrder"("appointmentId");

ALTER TABLE "CustomerOrder"
  ADD CONSTRAINT "CustomerOrder_appointmentId_fkey"
  FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
