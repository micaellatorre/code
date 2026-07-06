import { z } from "zod"
import prisma from "@/lib/prisma"
import { createAuditLog } from "@/lib/domain/audit"
import { normalizeProvinceId } from "@/lib/domain/argentina/provinces"
import { syncAdminCoverageForNewBranch } from "@/lib/domain/user-branches"
import type { UserRole } from "@prisma/client"

export const branchSchema = z.object({
  code: z.string().trim().min(1, "El codigo es obligatorio").max(32),
  name: z.string().trim().min(1, "El nombre es obligatorio").max(120),
  province: z.string().trim().max(80).optional().nullable(),
  provinceId: z.string().trim().max(2).optional().nullable(),
  coverageProvinceIds: z.array(z.string().trim().max(2)).optional(),
  city: z.string().trim().max(80).optional().nullable(),
  address: z.string().trim().max(160).optional().nullable(),
  phone: z.string().trim().max(80).optional().nullable(),
  email: z.string().trim().email("Email invalido").optional().or(z.literal("")).nullable(),
  isActive: z.boolean().optional(),
})

type BranchPatchInput = Partial<z.infer<typeof branchSchema>>

function nullable(value?: string | null) {
  return value?.trim() ? value.trim() : null
}

const branchInclude = {
  provinceRef: true,
  provinceCoverages: { include: { province: true }, orderBy: { province: { name: "asc" as const } } },
  _count: { select: { products: true, sales: true, purchases: true } },
}

function normalizedProvinceList(values: string[] | undefined) {
  return Array.from(new Set((values ?? []).map(normalizeProvinceId).filter((value): value is string => Boolean(value))))
}

async function assertProvinceIds(tx: { province: { findMany: typeof prisma.province.findMany } }, provinceIds: string[]) {
  const uniqueProvinceIds = Array.from(new Set(provinceIds))
  if (!uniqueProvinceIds.length) return
  const found = await tx.province.findMany({ where: { id: { in: uniqueProvinceIds } }, select: { id: true } })
  if (found.length !== uniqueProvinceIds.length) throw new Error("Provincia invalida")
}

export async function listBranches(tenantId: string) {
  return prisma.branch.findMany({
    where: { tenantId },
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
    include: branchInclude,
  })
}

export async function createBranch(params: {
  tenantId: string
  actorUserId: string
  actorRole: UserRole
  input: z.infer<typeof branchSchema>
}) {
  const input = branchSchema.parse(params.input)
  return prisma.$transaction(async (tx) => {
    const provinceId = normalizeProvinceId(input.provinceId)
    const coverageProvinceIds = normalizedProvinceList(input.coverageProvinceIds)
    await assertProvinceIds(tx, [provinceId, ...coverageProvinceIds].filter((value): value is string => Boolean(value)))

    const existing = await tx.branch.findUnique({
      where: { tenantId_code: { tenantId: params.tenantId, code: input.code } },
      select: { id: true },
    })
    if (existing) throw new Error("Ya existe una sucursal con ese codigo")

    const branch = await tx.branch.create({
      data: {
        tenantId: params.tenantId,
        code: input.code,
        name: input.name,
        province: nullable(input.province),
        provinceId,
        city: nullable(input.city),
        address: nullable(input.address),
        phone: nullable(input.phone),
        email: nullable(input.email),
        isActive: input.isActive ?? true,
        provinceCoverages: {
          createMany: {
            data: coverageProvinceIds.map((coveredProvinceId) => ({ provinceId: coveredProvinceId })),
            skipDuplicates: true,
          },
        },
      },
      include: branchInclude,
    })

    await createAuditLog({
      tenantId: params.tenantId,
      actorUserId: params.actorUserId,
      actorRole: params.actorRole,
      action: "CREATE",
      module: "USER",
      entityType: "Branch",
      entityId: branch.id,
      detail: `Sucursal creada: ${branch.name}`,
      newValue: branch,
    }, tx)

    await syncAdminCoverageForNewBranch({ tenantId: params.tenantId, branchId: branch.id }, tx)

    return branch
  })
}

export async function updateBranch(params: {
  tenantId: string
  branchId: string
  actorUserId: string
  actorRole: UserRole
  input: BranchPatchInput
}) {
  const input = branchSchema.partial().parse(params.input)
  return prisma.$transaction(async (tx) => {
    const current = await tx.branch.findFirst({ where: { id: params.branchId, tenantId: params.tenantId }, include: branchInclude })
    if (!current) throw new Error("Sucursal no encontrada")
    const provinceId = input.provinceId !== undefined ? normalizeProvinceId(input.provinceId) : undefined
    const coverageProvinceIds = input.coverageProvinceIds !== undefined ? normalizedProvinceList(input.coverageProvinceIds) : undefined
    await assertProvinceIds(tx, [provinceId, ...(coverageProvinceIds ?? [])].filter((value): value is string => Boolean(value)))

    if (input.code && input.code !== current.code) {
      const duplicate = await tx.branch.findUnique({
        where: { tenantId_code: { tenantId: params.tenantId, code: input.code } },
        select: { id: true },
      })
      if (duplicate) throw new Error("Ya existe una sucursal con ese codigo")
    }

    const branch = await tx.branch.update({
      where: { id: current.id },
      data: {
        ...(input.code !== undefined ? { code: input.code } : {}),
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.province !== undefined ? { province: nullable(input.province) } : {}),
        ...(input.provinceId !== undefined ? { provinceId } : {}),
        ...(input.city !== undefined ? { city: nullable(input.city) } : {}),
        ...(input.address !== undefined ? { address: nullable(input.address) } : {}),
        ...(input.phone !== undefined ? { phone: nullable(input.phone) } : {}),
        ...(input.email !== undefined ? { email: nullable(input.email) } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      },
      include: branchInclude,
    })

    if (coverageProvinceIds) {
      await tx.branchProvinceCoverage.deleteMany({ where: { branchId: current.id } })
      if (coverageProvinceIds.length) {
        await tx.branchProvinceCoverage.createMany({
          data: coverageProvinceIds.map((coveredProvinceId) => ({ branchId: current.id, provinceId: coveredProvinceId })),
          skipDuplicates: true,
        })
      }
    }

    const branchWithCoverage = await tx.branch.findUniqueOrThrow({ where: { id: current.id }, include: branchInclude })

    await createAuditLog({
      tenantId: params.tenantId,
      actorUserId: params.actorUserId,
      actorRole: params.actorRole,
      action: "UPDATE",
      module: "USER",
      entityType: "Branch",
      entityId: branchWithCoverage.id,
      detail: coverageProvinceIds ? `Sucursal actualizada y cobertura geografica sincronizada: ${branchWithCoverage.name}` : `Sucursal actualizada: ${branchWithCoverage.name}`,
      oldValue: current,
      newValue: branchWithCoverage,
    }, tx)

    return branchWithCoverage
  })
}

export async function deleteOrDeactivateBranch(params: {
  tenantId: string
  branchId: string
  actorUserId: string
  actorRole: UserRole
}) {
  return prisma.$transaction(async (tx) => {
    const current = await tx.branch.findFirst({
      where: { id: params.branchId, tenantId: params.tenantId },
      include: { _count: { select: { products: true, sales: true, purchases: true } } },
    })
    if (!current) throw new Error("Sucursal no encontrada")

    const hasHistory = current._count.products + current._count.sales + current._count.purchases > 0
    if (hasHistory) {
      const branch = await tx.branch.update({ where: { id: current.id }, data: { isActive: false } })
      await createAuditLog({
        tenantId: params.tenantId,
        actorUserId: params.actorUserId,
        actorRole: params.actorRole,
        action: "UPDATE",
        module: "USER",
        entityType: "Branch",
        entityId: current.id,
        detail: `Sucursal desactivada por historial asociado: ${current.name}`,
      }, tx)
      return { mode: "deactivated" as const, branch }
    }

    await tx.branch.delete({ where: { id: current.id } })
    await createAuditLog({
      tenantId: params.tenantId,
      actorUserId: params.actorUserId,
      actorRole: params.actorRole,
      action: "DELETE",
      module: "USER",
      entityType: "Branch",
      entityId: current.id,
      detail: `Sucursal eliminada: ${current.name}`,
    }, tx)
    return { mode: "deleted" as const, branch: current }
  })
}
