-- Payment pricing / BNA installments
-- Additive migration. It also bootstraps the BNA clearing cash account for the current GP tenant.

ALTER TYPE "PaymentMethod" ADD VALUE IF NOT EXISTS 'BNA_CUOTAS';

ALTER TABLE "TenantSettings"
  ADD COLUMN IF NOT EXISTS "bnaInstallmentsEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "bnaMarkupRatePct" DECIMAL(5,2) NOT NULL DEFAULT 40,
  ADD COLUMN IF NOT EXISTS "bnaDefaultInstallments" INTEGER NOT NULL DEFAULT 12,
  ADD COLUMN IF NOT EXISTS "bnaCustomerRebatePct" DECIMAL(5,2) NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS "bnaCustomerRebateCapArs" DECIMAL(12,2) NOT NULL DEFAULT 30000;

ALTER TABLE "Sale"
  ADD COLUMN IF NOT EXISTS "exchangeRate" DECIMAL(12,4),
  ADD COLUMN IF NOT EXISTS "exchangeRateSource" TEXT,
  ADD COLUMN IF NOT EXISTS "exchangeRateAt" TIMESTAMP(3);

ALTER TABLE "Payment"
  ADD COLUMN IF NOT EXISTS "coveredBaseUsd" DECIMAL(14,6),
  ADD COLUMN IF NOT EXISTS "surchargePct" DECIMAL(5,2),
  ADD COLUMN IF NOT EXISTS "surchargeAmount" DECIMAL(12,2),
  ADD COLUMN IF NOT EXISTS "installments" INTEGER,
  ADD COLUMN IF NOT EXISTS "installmentAmount" DECIMAL(12,2),
  ADD COLUMN IF NOT EXISTS "pricingSnapshot" JSONB;

-- Ensure the tenant has settings before applying the business defaults.
INSERT INTO "TenantSettings" (
  "id",
  "tenantId",
  "updatedAt"
)
SELECT
  'gp-settings-cmh3grger0000hhx0cy3w32rw',
  'cmh3grger0000hhx0cy3w32rw',
  CURRENT_TIMESTAMP
WHERE EXISTS (
  SELECT 1 FROM "Tenant" WHERE "id" = 'cmh3grger0000hhx0cy3w32rw'
)
AND NOT EXISTS (
  SELECT 1 FROM "TenantSettings" WHERE "tenantId" = 'cmh3grger0000hhx0cy3w32rw'
);

-- Current GP commercial rules agreed for this stage.
UPDATE "TenantSettings"
SET
  "financialFeeEnabled" = true,
  "financialFeeRatePct" = 3.50,
  "bnaInstallmentsEnabled" = true,
  "bnaMarkupRatePct" = 40.00,
  "bnaDefaultInstallments" = 12,
  "bnaCustomerRebatePct" = 10.00,
  "bnaCustomerRebateCapArs" = 30000.00,
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "tenantId" = 'cmh3grger0000hhx0cy3w32rw';

-- BNA is represented as a tenant-scoped ARS clearing/bank account. The account
-- holds the native amount associated with BNA installments; the sale payment
-- keeps the commercial coverage in USD separately.
INSERT INTO "CashAccount" (
  "id",
  "tenantId",
  "code",
  "name",
  "type",
  "currency",
  "scope",
  "branchId",
  "sortOrder",
  "isActive",
  "createdAt",
  "updatedAt"
)
SELECT
  'gp-bna-cmh3grger0000hhx0cy3w32rw',
  'cmh3grger0000hhx0cy3w32rw',
  'BNA_INSTALLMENTS',
  'BNA Cuotas',
  'BANK'::"CashAccountType",
  'ARS'::"Currency",
  'TENANT'::"CashAccountScope",
  NULL,
  50,
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
WHERE EXISTS (
  SELECT 1 FROM "Tenant" WHERE "id" = 'cmh3grger0000hhx0cy3w32rw'
)
AND NOT EXISTS (
  SELECT 1
  FROM "CashAccount"
  WHERE "tenantId" = 'cmh3grger0000hhx0cy3w32rw'
    AND "code" = 'BNA_INSTALLMENTS'
);

CREATE INDEX IF NOT EXISTS "Payment_coveredBaseUsd_idx" ON "Payment"("coveredBaseUsd");
