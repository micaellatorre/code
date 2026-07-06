-- Generated with:
-- npx prisma migrate diff --from-schema %TEMP%\schema-before-provinces.prisma --to-schema prisma\schema.prisma --script

-- AlterTable
ALTER TABLE "Buyer" ADD COLUMN     "provinceId" TEXT,
ADD COLUMN     "registeredBranchId" TEXT;

-- AlterTable
ALTER TABLE "Supplier" ADD COLUMN     "addressNumber" TEXT,
ADD COLUMN     "addressStreet" TEXT,
ADD COLUMN     "city" TEXT,
ADD COLUMN     "postalCode" TEXT,
ADD COLUMN     "provinceId" TEXT;

-- AlterTable
ALTER TABLE "Branch" ADD COLUMN     "provinceId" TEXT;

-- CreateTable
CREATE TABLE "Province" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,

    CONSTRAINT "Province_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BranchProvinceCoverage" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "provinceId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BranchProvinceCoverage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Province_code_key" ON "Province"("code");

-- CreateIndex
CREATE INDEX "Province_name_idx" ON "Province"("name");

-- CreateIndex
CREATE INDEX "BranchProvinceCoverage_provinceId_idx" ON "BranchProvinceCoverage"("provinceId");

-- CreateIndex
CREATE UNIQUE INDEX "BranchProvinceCoverage_branchId_provinceId_key" ON "BranchProvinceCoverage"("branchId", "provinceId");

-- CreateIndex
CREATE INDEX "Buyer_provinceId_idx" ON "Buyer"("provinceId");

-- CreateIndex
CREATE INDEX "Buyer_registeredBranchId_idx" ON "Buyer"("registeredBranchId");

-- CreateIndex
CREATE INDEX "Supplier_provinceId_idx" ON "Supplier"("provinceId");

-- CreateIndex
CREATE INDEX "Branch_provinceId_idx" ON "Branch"("provinceId");

-- AddForeignKey
ALTER TABLE "Buyer" ADD CONSTRAINT "Buyer_provinceId_fkey" FOREIGN KEY ("provinceId") REFERENCES "Province"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Buyer" ADD CONSTRAINT "Buyer_registeredBranchId_fkey" FOREIGN KEY ("registeredBranchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Supplier" ADD CONSTRAINT "Supplier_provinceId_fkey" FOREIGN KEY ("provinceId") REFERENCES "Province"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Branch" ADD CONSTRAINT "Branch_provinceId_fkey" FOREIGN KEY ("provinceId") REFERENCES "Province"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BranchProvinceCoverage" ADD CONSTRAINT "BranchProvinceCoverage_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BranchProvinceCoverage" ADD CONSTRAINT "BranchProvinceCoverage_provinceId_fkey" FOREIGN KEY ("provinceId") REFERENCES "Province"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
