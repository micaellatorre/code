import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
})

const cachedPrisma = globalForPrisma.prisma
const cachedPrismaHasCurrentSchema =
  cachedPrisma &&
  "tradeInBatteryRange" in cachedPrisma &&
  "tradeInDeductionRule" in cachedPrisma &&
  "auditLog" in cachedPrisma &&
  "cashMovement" in cachedPrisma &&
  "serviceOrder" in cachedPrisma

const prisma =
  cachedPrismaHasCurrentSchema
    ? cachedPrisma
    : new PrismaClient({
        adapter,
      })

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma
}

export default prisma
