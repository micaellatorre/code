-- CreateTable
CREATE TABLE "SaleReceipt" (
    "id" SERIAL NOT NULL,
    "saleId" TEXT NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "generatedById" TEXT,

    CONSTRAINT "SaleReceipt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SaleReceipt_saleId_key" ON "SaleReceipt"("saleId");

-- CreateIndex
CREATE INDEX "SaleReceipt_generatedAt_idx" ON "SaleReceipt"("generatedAt");

-- CreateIndex
CREATE INDEX "SaleReceipt_generatedById_idx" ON "SaleReceipt"("generatedById");

-- AddForeignKey
ALTER TABLE "SaleReceipt" ADD CONSTRAINT "SaleReceipt_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleReceipt" ADD CONSTRAINT "SaleReceipt_generatedById_fkey" FOREIGN KEY ("generatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
