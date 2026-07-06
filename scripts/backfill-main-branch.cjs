require("dotenv/config")
const { PrismaClient } = require("@prisma/client")
const { PrismaPg } = require("@prisma/adapter-pg")

const DEFAULT_BRANCH_ID = "cmr8mxgy100007chhk3ctz7zp"
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
})

function readArg(name, fallback = null) {
  const index = process.argv.indexOf(name)
  if (index === -1) return fallback
  return process.argv[index + 1] ?? fallback
}

const dryRun = process.argv.includes("--dry-run")
const branchId = readArg("--branch-id", DEFAULT_BRANCH_ID)

async function main() {
  const branch = await prisma.branch.findUnique({
    where: { id: branchId },
    select: { id: true, name: true, code: true, tenantId: true },
  })

  if (!branch) {
    console.error(`No existe la sucursal ${branchId}.`)
    process.exitCode = 1
    return
  }

  const tenantId = branch.tenantId
  const [productCount, saleCount, users, tenantBranches] = await Promise.all([
    prisma.product.count({ where: { tenantId } }),
    prisma.sale.count({ where: { tenantId } }),
    prisma.user.findMany({
      where: { tenantId },
      select: { id: true, role: true, currentBranchId: true, branchCoverages: { select: { branchId: true } } },
    }),
    prisma.branch.findMany({ where: { tenantId }, select: { id: true } }),
  ])

  const usersToInitialize = users.filter((user) => !user.currentBranchId)
  const admins = users.filter((user) => user.role === "ADMIN")
  const adminCoverageData = admins.flatMap((admin) => tenantBranches.map((tenantBranch) => ({ userId: admin.id, branchId: tenantBranch.id })))
  const existingCoverage = new Set(users.flatMap((user) => user.branchCoverages.map((coverage) => `${user.id}:${coverage.branchId}`)))
  const adminCoveragesToCreate = adminCoverageData.filter((coverage) => !existingCoverage.has(`${coverage.userId}:${coverage.branchId}`))
  const nonAdminsWithoutCoverage = users.filter((user) => user.role !== "ADMIN" && user.branchCoverages.length === 0)

  console.log(`SUCURSAL TARGET ID: ${branch.id}`)
  console.log(`Nombre: ${branch.name}`)
  console.log(`Tenant: ${tenantId}`)
  console.log("PRODUCTS")
  console.log(`Encontrados: ${productCount}`)
  console.log(`A actualizar: ${productCount}`)
  console.log("SALES")
  console.log(`Encontradas: ${saleCount}`)
  console.log(`A actualizar: ${saleCount}`)
  console.log("USERS")
  console.log(`Encontrados: ${users.length}`)
  console.log(`Current Branch inicializada: ${usersToInitialize.length}`)
  console.log("ADMIN COVERAGE")
  console.log(`Administradores: ${admins.length}`)
  console.log(`Coberturas nuevas: ${adminCoveragesToCreate.length}`)
  console.log("OTHER USER COVERAGE")
  console.log(`Usuarios sin cobertura: ${nonAdminsWithoutCoverage.length}`)
  console.log(`Coberturas iniciales: ${nonAdminsWithoutCoverage.length}`)

  if (dryRun) return

  await prisma.$transaction(async (tx) => {
    await tx.product.updateMany({ where: { tenantId }, data: { branchId: branch.id } })
    await tx.sale.updateMany({ where: { tenantId }, data: { branchId: branch.id } })
    await tx.user.updateMany({ where: { tenantId, currentBranchId: null }, data: { currentBranchId: branch.id } })

    if (adminCoverageData.length) {
      await tx.userBranchCoverage.createMany({ data: adminCoverageData, skipDuplicates: true })
    }

    if (nonAdminsWithoutCoverage.length) {
      await tx.userBranchCoverage.createMany({
        data: nonAdminsWithoutCoverage.map((user) => ({ userId: user.id, branchId: user.currentBranchId || branch.id })),
        skipDuplicates: true,
      })
    }
  })

  console.log("Backfill completado correctamente.")
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
