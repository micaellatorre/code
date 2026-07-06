-- Migration: user branch context (additive)
-- Review before applying with your local Prisma migration workflow.

-- AlterTable
ALTER TABLE "User" ADD COLUMN "currentBranchId" TEXT;

-- CreateTable
CREATE TABLE "UserBranchCoverage" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserBranchCoverage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "User_currentBranchId_idx" ON "User"("currentBranchId");

-- CreateIndex
CREATE INDEX "UserBranchCoverage_branchId_idx" ON "UserBranchCoverage"("branchId");

-- CreateIndex
CREATE UNIQUE INDEX "UserBranchCoverage_userId_branchId_key" ON "UserBranchCoverage"("userId", "branchId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_currentBranchId_fkey" FOREIGN KEY ("currentBranchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserBranchCoverage" ADD CONSTRAINT "UserBranchCoverage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserBranchCoverage" ADD CONSTRAINT "UserBranchCoverage_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
