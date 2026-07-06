import { PrismaClient } from "@prisma/client"
import {
  ARGENTINA_PROVINCES,
  getProvinceByCode,
  getProvinceByName,
  normalizeProvinceText,
  type ProvinceOption,
} from "../src/lib/domain/argentina/provinces"

const prisma = new PrismaClient()
const dryRun = process.argv.includes("--dry-run")

const aliases = new Map<string, ProvinceOption>([
  ["caba", ARGENTINA_PROVINCES.find((province) => province.code === "C")!],
  ["capital federal", ARGENTINA_PROVINCES.find((province) => province.code === "C")!],
  ["ciudad autonoma buenos aires", ARGENTINA_PROVINCES.find((province) => province.code === "C")!],
  ["ciudad autonoma de buenos aires", ARGENTINA_PROVINCES.find((province) => province.code === "C")!],
  ["bs as", ARGENTINA_PROVINCES.find((province) => province.code === "B")!],
  ["buenos aires provincia", ARGENTINA_PROVINCES.find((province) => province.code === "B")!],
  ["tierra del fuego", ARGENTINA_PROVINCES.find((province) => province.code === "V")!],
])

type BackfillStats = {
  processed: number
  linked: number
  unmatched: Array<{ id: string; province: string | null }>
}

function resolveProvince(value: string | null): ProvinceOption | null {
  if (!value) return null
  const codeMatch = getProvinceByCode(value)
  if (codeMatch) return codeMatch

  const nameMatch = getProvinceByName(value)
  if (nameMatch) return nameMatch

  return aliases.get(normalizeProvinceText(value)) ?? null
}

async function backfillBuyers() {
  const stats: BackfillStats = { processed: 0, linked: 0, unmatched: [] }
  const buyers = await prisma.buyer.findMany({
    where: { provinceId: null, province: { not: null } },
    select: { id: true, province: true },
  })

  for (const buyer of buyers) {
    stats.processed += 1
    const province = resolveProvince(buyer.province)
    if (!province) {
      stats.unmatched.push({ id: buyer.id, province: buyer.province })
      continue
    }

    stats.linked += 1
    if (!dryRun) {
      await prisma.buyer.update({ where: { id: buyer.id }, data: { provinceId: province.id } })
    }
  }

  return stats
}

async function backfillBranches() {
  const stats: BackfillStats = { processed: 0, linked: 0, unmatched: [] }
  const branches = await prisma.branch.findMany({
    where: { provinceId: null, province: { not: null } },
    select: { id: true, province: true },
  })

  for (const branch of branches) {
    stats.processed += 1
    const province = resolveProvince(branch.province)
    if (!province) {
      stats.unmatched.push({ id: branch.id, province: branch.province })
      continue
    }

    stats.linked += 1
    if (!dryRun) {
      await prisma.branch.update({ where: { id: branch.id }, data: { provinceId: province.id } })
    }
  }

  return stats
}

async function main() {
  const [buyers, branches] = await Promise.all([backfillBuyers(), backfillBranches()])
  console.log(JSON.stringify({ dryRun, buyers, branches }, null, 2))
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
