import { PrismaClient } from "@prisma/client"
import { ARGENTINA_PROVINCES } from "../src/lib/domain/argentina/provinces"

const prisma = new PrismaClient()

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
