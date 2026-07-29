-- CreateEnum
CREATE TYPE "TenantAssetKind" AS ENUM ('LOGO');

-- CreateEnum
CREATE TYPE "CatalogSource" AS ENUM ('BASE', 'CUSTOM', 'LEGACY');

-- AlterEnum
ALTER TYPE "AuditModule" ADD VALUE 'CONFIG';
ALTER TYPE "AuditModule" ADD VALUE 'CATALOG';

-- AlterTable
ALTER TABLE "User"
  ADD COLUMN "invitedAt" TIMESTAMP(3),
  ADD COLUMN "joinedAt" TIMESTAMP(3),
  ADD COLUMN "invitedById" TEXT;

-- Existing users already joined before the invitation feature existed.
UPDATE "User"
SET "joinedAt" = COALESCE("lastLoginAt", "createdAt")
WHERE "joinedAt" IS NULL;

-- AlterTable
ALTER TABLE "Product"
  ADD COLUMN "wholesalePrice" DECIMAL(12,2),
  ADD COLUMN "catalogModelId" TEXT,
  ADD COLUMN "catalogCapacityId" TEXT,
  ADD COLUMN "catalogColorId" TEXT;

-- CreateTable
CREATE TABLE "TenantSettings" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "servicePickupAlertDays" INTEGER NOT NULL DEFAULT 15,
  "stockRotationHighMaxDays" INTEGER NOT NULL DEFAULT 15,
  "stockRotationMediumMaxDays" INTEGER NOT NULL DEFAULT 30,
  "accessoryLowStockThreshold" INTEGER NOT NULL DEFAULT 5,
  "wholesalePricesEnabled" BOOLEAN NOT NULL DEFAULT false,
  "closerCommissionsEnabled" BOOLEAN NOT NULL DEFAULT false,
  "financialFeeEnabled" BOOLEAN NOT NULL DEFAULT false,
  "financialFeeRatePct" DECIMAL(5,2) NOT NULL DEFAULT 0,
  "usedDeviceWarrantyDays" INTEGER NOT NULL DEFAULT 30,
  "warrantyPolicyText" TEXT NOT NULL DEFAULT '',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "TenantSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenantAsset" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "kind" "TenantAssetKind" NOT NULL,
  "fileName" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "sizeBytes" INTEGER NOT NULL,
  "data" BYTEA NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "TenantAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductCatalogModel" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "type" "ProductType" NOT NULL,
  "name" TEXT NOT NULL,
  "normalizedName" TEXT NOT NULL,
  "source" "CatalogSource" NOT NULL DEFAULT 'CUSTOM',
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ProductCatalogModel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductCatalogCapacity" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "capacityGB" INTEGER NOT NULL,
  "label" TEXT NOT NULL,
  "source" "CatalogSource" NOT NULL DEFAULT 'CUSTOM',
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ProductCatalogCapacity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductCatalogMeasure" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "millimeters" DECIMAL(8,2) NOT NULL,
  "source" "CatalogSource" NOT NULL DEFAULT 'CUSTOM',
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ProductCatalogMeasure_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductCatalogColor" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "normalizedName" TEXT NOT NULL,
  "hexColor" TEXT NOT NULL,
  "source" "CatalogSource" NOT NULL DEFAULT 'CUSTOM',
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ProductCatalogColor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductCatalogColorAlias" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "colorId" TEXT NOT NULL,
  "alias" TEXT NOT NULL,
  "normalizedAlias" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ProductCatalogColorAlias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductModelCompatibility" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "phoneModelId" TEXT NOT NULL,
  "accessoryModelId" TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ProductModelCompatibility_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TenantSettings_tenantId_key" ON "TenantSettings"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "TenantAsset_tenantId_kind_key" ON "TenantAsset"("tenantId", "kind");
CREATE INDEX "TenantAsset_tenantId_idx" ON "TenantAsset"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductCatalogModel_tenantId_type_normalizedName_key" ON "ProductCatalogModel"("tenantId", "type", "normalizedName");
CREATE INDEX "ProductCatalogModel_tenantId_type_isActive_idx" ON "ProductCatalogModel"("tenantId", "type", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "ProductCatalogCapacity_tenantId_capacityGB_key" ON "ProductCatalogCapacity"("tenantId", "capacityGB");
CREATE INDEX "ProductCatalogCapacity_tenantId_isActive_idx" ON "ProductCatalogCapacity"("tenantId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "ProductCatalogMeasure_tenantId_millimeters_key" ON "ProductCatalogMeasure"("tenantId", "millimeters");
CREATE INDEX "ProductCatalogMeasure_tenantId_isActive_idx" ON "ProductCatalogMeasure"("tenantId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "ProductCatalogColor_tenantId_normalizedName_key" ON "ProductCatalogColor"("tenantId", "normalizedName");
CREATE INDEX "ProductCatalogColor_tenantId_isActive_idx" ON "ProductCatalogColor"("tenantId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "ProductCatalogColorAlias_tenantId_normalizedAlias_key" ON "ProductCatalogColorAlias"("tenantId", "normalizedAlias");
CREATE INDEX "ProductCatalogColorAlias_colorId_idx" ON "ProductCatalogColorAlias"("colorId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductModelCompatibility_tenantId_phoneModelId_accessoryModelId_key" ON "ProductModelCompatibility"("tenantId", "phoneModelId", "accessoryModelId");
CREATE INDEX "ProductModelCompatibility_tenantId_phoneModelId_isActive_idx" ON "ProductModelCompatibility"("tenantId", "phoneModelId", "isActive");
CREATE INDEX "ProductModelCompatibility_tenantId_accessoryModelId_isActive_idx" ON "ProductModelCompatibility"("tenantId", "accessoryModelId", "isActive");

-- CreateIndex
CREATE INDEX "User_invitedById_idx" ON "User"("invitedById");
CREATE INDEX "Product_catalogModelId_idx" ON "Product"("catalogModelId");
CREATE INDEX "Product_catalogCapacityId_idx" ON "Product"("catalogCapacityId");
CREATE INDEX "Product_catalogColorId_idx" ON "Product"("catalogColorId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantSettings" ADD CONSTRAINT "TenantSettings_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantAsset" ADD CONSTRAINT "TenantAsset_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductCatalogModel" ADD CONSTRAINT "ProductCatalogModel_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductCatalogCapacity" ADD CONSTRAINT "ProductCatalogCapacity_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductCatalogMeasure" ADD CONSTRAINT "ProductCatalogMeasure_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductCatalogColor" ADD CONSTRAINT "ProductCatalogColor_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductCatalogColorAlias" ADD CONSTRAINT "ProductCatalogColorAlias_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductCatalogColorAlias" ADD CONSTRAINT "ProductCatalogColorAlias_colorId_fkey" FOREIGN KEY ("colorId") REFERENCES "ProductCatalogColor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductModelCompatibility" ADD CONSTRAINT "ProductModelCompatibility_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductModelCompatibility" ADD CONSTRAINT "ProductModelCompatibility_phoneModelId_fkey" FOREIGN KEY ("phoneModelId") REFERENCES "ProductCatalogModel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductModelCompatibility" ADD CONSTRAINT "ProductModelCompatibility_accessoryModelId_fkey" FOREIGN KEY ("accessoryModelId") REFERENCES "ProductCatalogModel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_catalogModelId_fkey" FOREIGN KEY ("catalogModelId") REFERENCES "ProductCatalogModel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_catalogCapacityId_fkey" FOREIGN KEY ("catalogCapacityId") REFERENCES "ProductCatalogCapacity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_catalogColorId_fkey" FOREIGN KEY ("catalogColorId") REFERENCES "ProductCatalogColor"("id") ON DELETE SET NULL ON UPDATE CASCADE;
