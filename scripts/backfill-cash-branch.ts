import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

function readArg(name: string) {
  const index = process.argv.indexOf(name)
  if (index === -1) return null
  return process.argv[index + 1] ?? null
}

const branchId = readArg("--branch-id")
const dryRun = process.argv.includes("--dry-run")

async function main() {
  if (!branchId) {
    console.error("Uso: npm run backfill:cash-branch -- --branch-id <id> [--dry-run]")
    process.exitCode = 1
    return
  }

  const branch = await prisma.branch.findUnique({
    where: { id: branchId },
    select: { id: true, code: true, name: true, tenantId: true },
  })

  if (!branch) {
    console.error(`No existe la sucursal ${branchId}.`)
    process.exitCode = 1
    return
  }

  const [movementCount, transferCount] = await Promise.all([
    prisma.cashMovement.count({ where: { tenantId: branch.tenantId, branchId: null } }),
    prisma.cashTransfer.count({ where: { tenantId: branch.tenantId, branchId: null } }),
  ])

  console.log(`SUCURSAL TARGET ID: ${branch.id}`)
  console.log(`Nombre: ${branch.name}`)
  console.log(`Tenant: ${branch.tenantId}`)
  console.log("CASH MOVEMENTS")
  console.log(`Encontrados sin sucursal: ${movementCount}`)
  console.log(`A actualizar: ${movementCount}`)
  console.log("CASH TRANSFERS")
  console.log(`Encontradas sin sucursal: ${transferCount}`)
  console.log(`A actualizar: ${transferCount}`)
  console.log("OTHER TENANTS")
  console.log("Registros afectados: 0")

  if (dryRun) {
    console.log("Dry-run: sin writes.")
    return
  }

  await prisma.$transaction(async (tx) => {
    await tx.cashMovement.updateMany({
      where: { tenantId: branch.tenantId, branchId: null },
      data: { branchId: branch.id },
    })
    await tx.cashTransfer.updateMany({
      where: { tenantId: branch.tenantId, branchId: null },
      data: { branchId: branch.id },
    })
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
