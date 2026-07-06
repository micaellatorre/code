require("dotenv/config")
const { PrismaClient } = require("@prisma/client")
const { PrismaPg } = require("@prisma/adapter-pg")
const {
  ARGENTINA_PROVINCES,
  getProvinceByCode,
  getProvinceByName,
  normalizeProvinceText,
} = require("./argentina-provinces.cjs")

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
})
const dryRun = process.argv.includes("--dry-run")

const provinceByCode = (code) => ARGENTINA_PROVINCES.find((province) => province.code === code)
const aliases = new Map([
  ["caba", provinceByCode("C")],
  ["capital federal", provinceByCode("C")],
  ["ciudad autonoma buenos aires", provinceByCode("C")],
  ["ciudad autonoma de buenos aires", provinceByCode("C")],
  ["bs as", provinceByCode("B")],
  ["buenos aires provincia", provinceByCode("B")],
  ["tierra del fuego", provinceByCode("V")],
])

function resolveProvince(value) {
  if (!value) return null
  return getProvinceByCode(value) ?? getProvinceByName(value) ?? aliases.get(normalizeProvinceText(value)) ?? null
}

async function backfillBuyers() {
  const stats = { processed: 0, linked: 0, unmatched: [] }
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
    if (!dryRun) await prisma.buyer.update({ where: { id: buyer.id }, data: { provinceId: province.id } })
  }

  return stats
}

async function backfillBranches() {
  const stats = { processed: 0, linked: 0, unmatched: [] }
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
    if (!dryRun) await prisma.branch.update({ where: { id: branch.id }, data: { provinceId: province.id } })
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
