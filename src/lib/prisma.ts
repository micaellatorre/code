import { PrismaClient } from '@prisma/client'

/**
 * Instancia única de Prisma Client.
 *
 * En Next.js (App Router) es importante reutilizar la conexión
 * para evitar agotar el pool de conexiones en entornos serverless.
 */
const globalForPrisma = global as unknown as { prisma: PrismaClient | undefined }

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ['query'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

export default prisma