-- Migracion aditiva para completar compras a proveedores.
-- Revisar contra la migracion generada por Prisma antes de aplicar en entornos compartidos.

-- 1. AuditModule: agregar SUPPLIER.
ALTER TYPE "AuditModule" ADD VALUE IF NOT EXISTS 'SUPPLIER';

-- 2. Supplier: sucursal principal nullable para preservar proveedores historicos.
ALTER TABLE "Supplier"
ADD COLUMN IF NOT EXISTS "branchId" TEXT;

CREATE INDEX IF NOT EXISTS "Supplier_branchId_idx" ON "Supplier"("branchId");

ALTER TABLE "Supplier"
ADD CONSTRAINT "Supplier_branchId_fkey"
FOREIGN KEY ("branchId") REFERENCES "Branch"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

-- 3. Coberturas adicionales de proveedor.
CREATE TABLE IF NOT EXISTS "SupplierBranchCoverage" (
  "id" TEXT NOT NULL,
  "supplierId" TEXT NOT NULL,
  "branchId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SupplierBranchCoverage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "SupplierBranchCoverage_supplierId_branchId_key"
ON "SupplierBranchCoverage"("supplierId", "branchId");

CREATE INDEX IF NOT EXISTS "SupplierBranchCoverage_branchId_idx"
ON "SupplierBranchCoverage"("branchId");

ALTER TABLE "SupplierBranchCoverage"
ADD CONSTRAINT "SupplierBranchCoverage_supplierId_fkey"
FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SupplierBranchCoverage"
ADD CONSTRAINT "SupplierBranchCoverage_branchId_fkey"
FOREIGN KEY ("branchId") REFERENCES "Branch"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- No se realiza backfill arbitrario de Supplier.branchId.
-- Los proveedores historicos sin sucursal principal siguen siendo legibles.
