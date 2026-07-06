require("dotenv/config")
const { PrismaClient } = require("@prisma/client")
const { PrismaPg } = require("@prisma/adapter-pg")
const { ARGENTINA_PROVINCES } = require("./argentina-provinces.cjs")

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
})

async function main() {
  for (const province of ARGENTINA_PROVINCES) {
    await prisma.province.upsert({
      where: { code: province.code },
      update: { id: province.id, name: province.name },
      create: province,
    })
  }

  console.log(`Provincias argentinas sincronizadas: ${ARGENTINA_PROVINCES.length}`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
