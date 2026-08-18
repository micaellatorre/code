-- Default transfer surcharge for ARS transfers.
-- Existing tenants that still have the legacy empty values get the agreed 3.5%.

ALTER TABLE "TenantSettings"
  ALTER COLUMN "financialFeeEnabled" SET DEFAULT true,
  ALTER COLUMN "financialFeeRatePct" SET DEFAULT 3.50;

UPDATE "TenantSettings"
SET
  "financialFeeEnabled" = true,
  "financialFeeRatePct" = 3.50,
  "updatedAt" = CURRENT_TIMESTAMP
WHERE
  "financialFeeEnabled" = false
  AND "financialFeeRatePct" <= 0;
