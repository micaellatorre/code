import { Prisma, type UserRole } from "@prisma/client"
import { z } from "zod"
import prisma from "@/lib/prisma"
import { createAuditLog } from "@/lib/domain/audit"
import { normalizePostalCode, normalizeProvinceId } from "@/lib/domain/argentina/provinces"

export const supplierSchema = z.object({
  name: z.string().trim().min(1, "El nombre es obligatorio").max(160),
  contactName: z.string().trim().max(120).optional().nullable(),
  phone: z.string().trim().max(80).optional().nullable(),
  email: z.string().trim().email("Email invalido").optional().or(z.literal("")).nullable(),
  provinceId: z.string().trim().max(2).optional().nullable(),
  city: z.string().trim().max(80).optional().nullable(),
  postalCode: z.string().trim().max(8).optional().nullable(),
  addressStreet: z.string().trim().max(120).optional().nullable(),
  addressNumber: z.string().trim().max(40).optional().nullable(),
  branchId: z.string().trim().min(1, "La sucursal principal es obligatoria"),
  branchCoverageIds: z.array(z.string().trim().min(1)).optional().default([]),
})

export type SupplierInput = z.infer<typeof supplierSchema>

export function supplierErrorStatus(message: string) {
  const normalized = message.toLowerCase()
  if (normalized.includes("no encontrado")) return 404
  if (normalized.includes("compras asociadas")) return 409
  if (
    normalized.includes("inval") ||
    normalized.includes("obligatoria") ||
    normalized.includes("cobertura") ||
    normalized.includes("sucursal") ||
    normalized.includes("repetirse")
  ) {
    return 400
  }
  return 500
}

type SupplierWithRelations = Prisma.SupplierGetPayload<{
  include: {
    provinceRef: true
    branch: true
    branchCoverages: { include: { branch: true }; orderBy: { branch: { name: "asc" } } }
    _count: { select: { purchases: true } }
  }
}>

type SupplierDetail = Prisma.SupplierGetPayload<{
  include: {
    provinceRef: true
    branch: true
    branchCoverages: { include: { branch: true }; orderBy: { branch: { name: "asc" } } }
    purchases: {
      orderBy: { date: "desc" }
      take: 5
      include: { branch: true; items: { include: { product: true } } }
    }
    _count: { select: { purchases: true } }
  }
}>

function nullable(value?: string | null) {
  return value?.trim() ? value.trim() : null
}

function normalizeSupplierFields(input: Partial<SupplierInput>) {
  const rawProvinceId = nullable(input.provinceId)
  const provinceId = rawProvinceId ? normalizeProvinceId(rawProvinceId) : null
  if (rawProvinceId && !provinceId) throw new Error("Provincia invalida")

  return {
    ...(input.name !== undefined ? { name: input.name.trim() } : {}),
    contactName: nullable(input.contactName),
    phone: nullable(input.phone),
    email: nullable(input.email),
    provinceId,
    city: nullable(input.city),
    postalCode: normalizePostalCode(input.postalCode),
    addressStreet: nullable(input.addressStreet),
    addressNumber: nullable(input.addressNumber),
    branchId: nullable(input.branchId),
  }
}

async function assertProvince(provinceId: string | null, tx: Prisma.TransactionClient = prisma) {
  if (!provinceId) return
  const province = await tx.province.findUnique({ where: { id: provinceId }, select: { id: true } })
  if (!province) throw new Error("Provincia invalida")
}

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)))
}

async function validateSupplierBranches(params: {
  tenantId: string
  branchId: string | null
  branchCoverageIds: string[]
  tx?: Prisma.TransactionClient
}) {
  const tx = params.tx ?? prisma
  if (!params.branchId) throw new Error("La sucursal principal es obligatoria")

  const coverageIds = uniqueStrings(params.branchCoverageIds)
  if (coverageIds.length !== params.branchCoverageIds.filter(Boolean).length) {
    throw new Error("Las coberturas no pueden repetirse")
  }
  if (coverageIds.includes(params.branchId)) {
    throw new Error("La sucursal principal no puede repetirse como cobertura")
  }

  const ids = [params.branchId, ...coverageIds]
  const branches = await tx.branch.findMany({
    where: { id: { in: ids }, tenantId: params.tenantId, isActive: true },
    select: { id: true, code: true, name: true },
  })
  if (branches.length !== ids.length) throw new Error("Una o mas sucursales son invalidas")

  return {
    branch: branches.find((branch) => branch.id === params.branchId)!,
    coverageIds,
  }
}

function branchDto(branch: { id: string; code: string; name: string } | null) {
  return branch ? { id: branch.id, code: branch.code, name: branch.name } : null
}

export function serializeSupplier(supplier: SupplierWithRelations, lastPurchaseAt?: Date | null) {
  return {
    id: supplier.id,
    name: supplier.name,
    contactName: supplier.contactName,
    phone: supplier.phone,
    email: supplier.email,
    provinceId: supplier.provinceId,
    provinceRef: supplier.provinceRef ? { id: supplier.provinceRef.id, code: supplier.provinceRef.code, name: supplier.provinceRef.name } : null,
    city: supplier.city,
    postalCode: supplier.postalCode,
    addressStreet: supplier.addressStreet,
    addressNumber: supplier.addressNumber,
    branchId: supplier.branchId,
    branch: branchDto(supplier.branch),
    branchCoverages: supplier.branchCoverages.map((coverage) => branchDto(coverage.branch)).filter((branch) => branch !== null),
    purchasesCount: supplier._count.purchases,
    lastPurchaseAt: lastPurchaseAt?.toISOString() ?? null,
    createdAt: supplier.createdAt.toISOString(),
    updatedAt: supplier.updatedAt.toISOString(),
  }
}

export function serializeSupplierDetail(supplier: SupplierDetail) {
  return {
    ...serializeSupplier(supplier, supplier.purchases[0]?.date ?? null),
    recentPurchases: supplier.purchases.map((purchase) => ({
      id: purchase.id,
      date: purchase.date.toISOString(),
      currency: purchase.currency,
      totalCost: purchase.totalCost.toString(),
      branch: branchDto(purchase.branch),
      items: purchase.items.map((item) => ({
        id: item.id,
        modelName: item.product.modelName,
        units: item.units,
      })),
    })),
  }
}

export async function listSuppliers(params: {
  tenantId: string
  q?: string | null
  branchId?: string | null
  page?: number
  pageSize?: number
}) {
  const page = Math.max(1, params.page ?? 1)
  const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 50))
  const q = params.q?.trim()
  const branchId = params.branchId?.trim()

  const and: Prisma.SupplierWhereInput[] = []
  if (q) {
    and.push({
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { contactName: { contains: q, mode: "insensitive" } },
        { phone: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
        { city: { contains: q, mode: "insensitive" } },
      ],
    })
  }
  if (branchId) {
    and.push({
      OR: [
        { branchId },
        { branchCoverages: { some: { branchId } } },
      ],
    })
  }

  const where: Prisma.SupplierWhereInput = {
    tenantId: params.tenantId,
    ...(and.length ? { AND: and } : {}),
  }

  const [total, suppliers, latestPurchases] = await prisma.$transaction([
    prisma.supplier.count({ where }),
    prisma.supplier.findMany({
      where,
      orderBy: { name: "asc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        provinceRef: true,
        branch: true,
        branchCoverages: { include: { branch: true }, orderBy: { branch: { name: "asc" } } },
        _count: { select: { purchases: true } },
      },
    }),
    prisma.purchase.groupBy({
      by: ["supplierId"],
      where: { tenantId: params.tenantId },
      orderBy: { supplierId: "asc" },
      _max: { date: true },
    }),
  ])

  const latestBySupplier = new Map(latestPurchases.map((row) => [row.supplierId, row._max?.date ?? null]))

  return {
    suppliers: suppliers.map((supplier) => serializeSupplier(supplier, latestBySupplier.get(supplier.id) ?? null)),
    pagination: { page, pageSize, total, pageCount: Math.ceil(total / pageSize) },
  }
}

export async function getSupplierDetail(params: { tenantId: string; supplierId: string }) {
  const supplier = await prisma.supplier.findFirst({
    where: { id: params.supplierId, tenantId: params.tenantId },
    include: {
      provinceRef: true,
      branch: true,
      branchCoverages: { include: { branch: true }, orderBy: { branch: { name: "asc" } } },
      purchases: {
        orderBy: { date: "desc" },
        take: 5,
        include: { branch: true, items: { include: { product: true } } },
      },
      _count: { select: { purchases: true } },
    },
  })
  return supplier ? serializeSupplierDetail(supplier) : null
}

function auditSupplierValue(supplier: {
  id: string
  name: string
  branchId: string | null
  branchCoverages: Array<{ branchId: string }>
}) {
  return {
    id: supplier.id,
    name: supplier.name,
    branchId: supplier.branchId,
    branchCoverageIds: supplier.branchCoverages.map((coverage) => coverage.branchId).sort(),
  }
}

export async function createSupplier(params: {
  tenantId: string
  actorUserId: string
  actorRole: UserRole
  actorRealRole?: UserRole
  input: SupplierInput
}) {
  const input = supplierSchema.parse(params.input)

  return prisma.$transaction(async (tx) => {
    const data = normalizeSupplierFields(input)
    await assertProvince(data.provinceId, tx)
    const { coverageIds } = await validateSupplierBranches({
      tenantId: params.tenantId,
      branchId: data.branchId,
      branchCoverageIds: input.branchCoverageIds,
      tx,
    })

    const supplier = await tx.supplier.create({
      data: {
        ...data,
        name: data.name!,
        tenantId: params.tenantId,
        branchCoverages: { create: coverageIds.map((branchId) => ({ branchId })) },
      },
      include: {
        provinceRef: true,
        branch: true,
        branchCoverages: { include: { branch: true }, orderBy: { branch: { name: "asc" } } },
        _count: { select: { purchases: true } },
      },
    })

    await createAuditLog({
      tenantId: params.tenantId,
      actorUserId: params.actorUserId,
      actorRole: params.actorRole,
      action: "CREATE",
      module: "SUPPLIER",
      entityType: "Supplier",
      entityId: supplier.id,
      detail: `Proveedor creado: ${supplier.name}`,
      newValue: auditSupplierValue(supplier),
      executedByAdminInSimulation: params.actorRealRole === "ADMIN" && params.actorRole !== "ADMIN",
      simulatedRole: params.actorRealRole === "ADMIN" && params.actorRole !== "ADMIN" ? params.actorRole : null,
    }, tx)

    return serializeSupplier(supplier, null)
  })
}

export async function updateSupplier(params: {
  tenantId: string
  supplierId: string
  actorUserId: string
  actorRole: UserRole
  actorRealRole?: UserRole
  input: SupplierInput
}) {
  const input = supplierSchema.parse(params.input)

  return prisma.$transaction(async (tx) => {
    const current = await tx.supplier.findFirst({
      where: { id: params.supplierId, tenantId: params.tenantId },
      include: { branchCoverages: true },
    })
    if (!current) throw new Error("Proveedor no encontrado")

    const data = normalizeSupplierFields(input)
    await assertProvince(data.provinceId, tx)
    const { coverageIds } = await validateSupplierBranches({
      tenantId: params.tenantId,
      branchId: data.branchId,
      branchCoverageIds: input.branchCoverageIds,
      tx,
    })

    await tx.supplierBranchCoverage.deleteMany({ where: { supplierId: current.id } })
    const supplier = await tx.supplier.update({
      where: { id: current.id },
      data: {
        ...data,
        branchCoverages: { create: coverageIds.map((branchId) => ({ branchId })) },
      },
      include: {
        provinceRef: true,
        branch: true,
        branchCoverages: { include: { branch: true }, orderBy: { branch: { name: "asc" } } },
        _count: { select: { purchases: true } },
      },
    })

    await createAuditLog({
      tenantId: params.tenantId,
      actorUserId: params.actorUserId,
      actorRole: params.actorRole,
      action: "UPDATE",
      module: "SUPPLIER",
      entityType: "Supplier",
      entityId: supplier.id,
      detail: `Proveedor actualizado: ${supplier.name}`,
      oldValue: auditSupplierValue(current),
      newValue: auditSupplierValue(supplier),
      executedByAdminInSimulation: params.actorRealRole === "ADMIN" && params.actorRole !== "ADMIN",
      simulatedRole: params.actorRealRole === "ADMIN" && params.actorRole !== "ADMIN" ? params.actorRole : null,
    }, tx)

    const latest = await tx.purchase.findFirst({
      where: { tenantId: params.tenantId, supplierId: supplier.id },
      orderBy: { date: "desc" },
      select: { date: true },
    })

    return serializeSupplier(supplier, latest?.date ?? null)
  })
}

export async function deleteSupplier(params: {
  tenantId: string
  supplierId: string
  actorUserId: string
  actorRole: UserRole
  actorRealRole?: UserRole
}) {
  return prisma.$transaction(async (tx) => {
    const supplier = await tx.supplier.findFirst({
      where: { id: params.supplierId, tenantId: params.tenantId },
      include: {
        branchCoverages: true,
        _count: { select: { purchases: true } },
      },
    })
    if (!supplier) throw new Error("Proveedor no encontrado")
    if (supplier._count.purchases > 0) {
      throw new Error("No se puede eliminar un proveedor con compras asociadas.")
    }

    await tx.supplier.delete({ where: { id: supplier.id } })
    await createAuditLog({
      tenantId: params.tenantId,
      actorUserId: params.actorUserId,
      actorRole: params.actorRole,
      action: "DELETE",
      module: "SUPPLIER",
      entityType: "Supplier",
      entityId: supplier.id,
      detail: `Proveedor eliminado: ${supplier.name}`,
      oldValue: auditSupplierValue(supplier),
      executedByAdminInSimulation: params.actorRealRole === "ADMIN" && params.actorRole !== "ADMIN",
      simulatedRole: params.actorRealRole === "ADMIN" && params.actorRole !== "ADMIN" ? params.actorRole : null,
    }, tx)

    return { success: true }
  })
}

export async function assertSupplierCoversBranch(params: {
  tenantId: string
  supplierId: string
  branchId: string
  tx?: Prisma.TransactionClient
}) {
  const tx = params.tx ?? prisma
  const supplier = await tx.supplier.findFirst({
    where: {
      id: params.supplierId,
      tenantId: params.tenantId,
      OR: [
        { branchId: params.branchId },
        { branchCoverages: { some: { branchId: params.branchId } } },
      ],
    },
    select: { id: true, name: true, branchId: true },
  })
  if (!supplier) throw new Error("El proveedor seleccionado no abastece la sucursal de la compra.")
  return supplier
}
