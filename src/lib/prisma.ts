import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = global as unknown as {
  prisma: PrismaClient;
};

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});

const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    adapter,
  });

  if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export default prisma;

// import { PrismaClient } from "@prisma/client";
// import { PrismaPg } from "@prisma/adapter-pg";
// import { Pool } from "pg";

// const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

// export const prisma =
//   globalForPrisma.prisma ??
//   new PrismaClient({
//     adapter: new PrismaPg(
//       new Pool({
//         connectionString: process.env.DATABASE_URL,
//       })
//     ),
//     log: ["query"],
//   });

// if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

// export default prisma;