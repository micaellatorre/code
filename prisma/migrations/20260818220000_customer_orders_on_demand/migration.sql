-- Customer Orders / Pedidos On-Demand
-- Additive migration. WholesaleOrder remains legacy and untouched.

CREATE TYPE "CustomerOrderStatus" AS ENUM (
  'CONFIRMED',
  'PROCUREMENT_PENDING',
  'ORDERED_TO_SUPPLIER',
  'IN_TRANSIT',
  'RECEIVED',
  'READY_FOR_DELIVERY',
  'CONVERTED',
  'CANCELLED'
);

CREATE TYPE "CustomerOrderSource" AS ENUM (
  'INTERNAL',
  'INSTAGRAM',
  'OFFICE',
  'ECOMMERCE',
  'WHATSAPP',
  'OTHER'
);

CREATE TYPE "CustomerOrderItemKind" AS ENUM ('STOCK', 'ON_DEMAND');
CREATE TYPE "CustomerOrderAllocationStatus" AS ENUM ('ACTIVE', 'CONSUMED', 'RELEASED');

ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'ORDER_CREATED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'ORDER_STATUS_CHANGE';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'ORDER_CANCELLED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'ORDER_CONVERTED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'ORDER_ITEM_ALLOCATED';
ALTER TYPE "AuditModule" ADD VALUE IF NOT EXISTS 'ORDER';
ALTER TYPE "CashMovementCategory" ADD VALUE IF NOT EXISTS 'CUSTOMER_ORDER_PAYMENT';
ALTER TYPE "CashMovementSource" ADD VALUE IF NOT EXISTS 'CUSTOMER_ORDER_PAYMENT';

ALTER TABLE "TenantSettings"
  ADD COLUMN IF NOT EXISTS "customerOrderMinimumDepositUsd" DECIMAL(12,2) NOT NULL DEFAULT 100,
  ADD COLUMN IF NOT EXISTS "customerOrderDefaultDeliveryDays" INTEGER NOT NULL DEFAULT 7,
  ADD COLUMN IF NOT EXISTS "customerOrderDeliveryDisclaimer" TEXT NOT NULL DEFAULT 'Fecha de entrega estimada. Puede presentar demoras por logística, disponibilidad de proveedor o causas ajenas al negocio.';

CREATE TABLE "CustomerOrder" (
  "id" TEXT NOT NULL,
  "orderNumber" SERIAL NOT NULL,
  "tenantId" TEXT NOT NULL,
  "buyerId" TEXT NOT NULL,
  "createdById" TEXT,
  "assignedSellerId" TEXT,
  "branchId" TEXT NOT NULL,
  "convertedSaleId" TEXT,
  "status" "CustomerOrderStatus" NOT NULL DEFAULT 'CONFIRMED',
  "source" "CustomerOrderSource" NOT NULL DEFAULT 'INTERNAL',
  "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "estimatedDeliveryAt" TIMESTAMP(3),
  "agreedTotalUsd" DECIMAL(12,2) NOT NULL,
  "amountPaidUsd" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "balanceDueUsd" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "notes" TEXT,
  "cancelledAt" TIMESTAMP(3),
  "convertedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CustomerOrder_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CustomerOrder_orderNumber_key" ON "CustomerOrder"("orderNumber");
CREATE UNIQUE INDEX "CustomerOrder_convertedSaleId_key" ON "CustomerOrder"("convertedSaleId");
CREATE INDEX "CustomerOrder_tenantId_requestedAt_idx" ON "CustomerOrder"("tenantId", "requestedAt");
CREATE INDEX "CustomerOrder_tenantId_status_idx" ON "CustomerOrder"("tenantId", "status");
CREATE INDEX "CustomerOrder_buyerId_idx" ON "CustomerOrder"("buyerId");
CREATE INDEX "CustomerOrder_createdById_idx" ON "CustomerOrder"("createdById");
CREATE INDEX "CustomerOrder_assignedSellerId_idx" ON "CustomerOrder"("assignedSellerId");
CREATE INDEX "CustomerOrder_branchId_idx" ON "CustomerOrder"("branchId");

CREATE TABLE "CustomerOrderItem" (
  "id" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "kind" "CustomerOrderItemKind" NOT NULL,
  "stockProductId" TEXT,
  "fulfilledProductId" TEXT,
  "purchaseItemId" TEXT,
  "catalogModelId" TEXT,
  "catalogCapacityId" TEXT,
  "catalogColorId" TEXT,
  "descriptionSnapshot" TEXT NOT NULL,
  "modelNameSnapshot" TEXT,
  "capacityGBSnapshot" INTEGER,
  "colorSnapshot" TEXT,
  "conditionSnapshot" "Condition",
  "quantity" INTEGER NOT NULL DEFAULT 1,
  "unitPriceUsd" DECIMAL(12,2) NOT NULL,
  "unitCostUsd" DECIMAL(12,2),
  "lineTotalUsd" DECIMAL(12,2) NOT NULL,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CustomerOrderItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CustomerOrderItem_orderId_idx" ON "CustomerOrderItem"("orderId");
CREATE INDEX "CustomerOrderItem_stockProductId_idx" ON "CustomerOrderItem"("stockProductId");
CREATE INDEX "CustomerOrderItem_fulfilledProductId_idx" ON "CustomerOrderItem"("fulfilledProductId");
CREATE INDEX "CustomerOrderItem_purchaseItemId_idx" ON "CustomerOrderItem"("purchaseItemId");
CREATE INDEX "CustomerOrderItem_catalogModelId_idx" ON "CustomerOrderItem"("catalogModelId");

CREATE TABLE "CustomerOrderInventoryAllocation" (
  "id" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "itemId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL,
  "status" "CustomerOrderAllocationStatus" NOT NULL DEFAULT 'ACTIVE',
  "reservedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "consumedAt" TIMESTAMP(3),
  "releasedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CustomerOrderInventoryAllocation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CustomerOrderInventoryAllocation_itemId_key" ON "CustomerOrderInventoryAllocation"("itemId");
CREATE INDEX "CustomerOrderInventoryAllocation_orderId_status_idx" ON "CustomerOrderInventoryAllocation"("orderId", "status");
CREATE INDEX "CustomerOrderInventoryAllocation_productId_status_idx" ON "CustomerOrderInventoryAllocation"("productId", "status");

CREATE TABLE "CustomerOrderPayment" (
  "id" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "method" "PaymentMethod" NOT NULL,
  "currency" "Currency" NOT NULL DEFAULT 'USD',
  "amount" DECIMAL(12,2) NOT NULL,
  "exchangeRate" DECIMAL(12,4),
  "amountUsd" DECIMAL(12,2),
  "coveredBaseUsd" DECIMAL(14,6),
  "surchargePct" DECIMAL(5,2),
  "surchargeAmount" DECIMAL(12,2),
  "installments" INTEGER,
  "installmentAmount" DECIMAL(12,2),
  "pricingSnapshot" JSONB,
  "cashAccountId" TEXT,
  "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CustomerOrderPayment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CustomerOrderPayment_orderId_paidAt_idx" ON "CustomerOrderPayment"("orderId", "paidAt");
CREATE INDEX "CustomerOrderPayment_cashAccountId_idx" ON "CustomerOrderPayment"("cashAccountId");
CREATE INDEX "CustomerOrderPayment_coveredBaseUsd_idx" ON "CustomerOrderPayment"("coveredBaseUsd");

ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "originCustomerOrderPaymentId" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "Payment_originCustomerOrderPaymentId_key" ON "Payment"("originCustomerOrderPaymentId");

ALTER TABLE "CustomerOrder"
  ADD CONSTRAINT "CustomerOrder_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "CustomerOrder_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "Buyer"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "CustomerOrder_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "CustomerOrder_assignedSellerId_fkey" FOREIGN KEY ("assignedSellerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "CustomerOrder_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "CustomerOrder_convertedSaleId_fkey" FOREIGN KEY ("convertedSaleId") REFERENCES "Sale"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CustomerOrderItem"
  ADD CONSTRAINT "CustomerOrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "CustomerOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "CustomerOrderItem_stockProductId_fkey" FOREIGN KEY ("stockProductId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "CustomerOrderItem_fulfilledProductId_fkey" FOREIGN KEY ("fulfilledProductId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "CustomerOrderItem_purchaseItemId_fkey" FOREIGN KEY ("purchaseItemId") REFERENCES "PurchaseItem"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "CustomerOrderItem_catalogModelId_fkey" FOREIGN KEY ("catalogModelId") REFERENCES "ProductCatalogModel"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "CustomerOrderItem_catalogCapacityId_fkey" FOREIGN KEY ("catalogCapacityId") REFERENCES "ProductCatalogCapacity"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "CustomerOrderItem_catalogColorId_fkey" FOREIGN KEY ("catalogColorId") REFERENCES "ProductCatalogColor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CustomerOrderInventoryAllocation"
  ADD CONSTRAINT "CustomerOrderInventoryAllocation_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "CustomerOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "CustomerOrderInventoryAllocation_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "CustomerOrderItem"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "CustomerOrderInventoryAllocation_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CustomerOrderPayment"
  ADD CONSTRAINT "CustomerOrderPayment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "CustomerOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "CustomerOrderPayment_cashAccountId_fkey" FOREIGN KEY ("cashAccountId") REFERENCES "CashAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Payment"
  ADD CONSTRAINT "Payment_originCustomerOrderPaymentId_fkey" FOREIGN KEY ("originCustomerOrderPaymentId") REFERENCES "CustomerOrderPayment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
