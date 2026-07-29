import { Prisma, type SaleType, type UserRole } from "@prisma/client"
import prisma from "@/lib/prisma"
import { createAuditLog } from "@/lib/domain/audit"
import { normalizeCatalogValue } from "@/lib/config/normalizeCatalogValue"
import { ensureTenantSettings } from "@/lib/config/settings"

const SELLABLE_STATES = ["EN_STOCK", "DISPONIBLE"] as const

export type CompatibleAccessorySuggestion = {
  catalogModelId: string
  modelName: string
  stockAvailable: number
  suggestedUnitPrice: string
  productIds: string[]
  products: {
    id: string
    tenantId: string
    type: "ACCESSORY"
    brand: string | null
    imei: string | null
    modelName: string
    catalogModelId: string | null
    capacityGB: number | null
    condition: string | null
    color: string | null
    batteryPct: number | null
    purchaseDate: string | null
    costPrice: string | null
    salePrice: string | null
    wholesalePrice: string | null
    shippingCost: string | null
    state: string
    senado: boolean
    senadoAt: string | null
    status: string
    stockInitial: number
    stock: number
    stockAvailable: number
    location: string | null
    branchId: string | null
    notes: string | null
    origin: string | null
    createdAt: string | null
    updatedAt: string | null
  }[]
}

async function assertCompatibilityModels(params: {
  tenantId: string
  phoneModelId: string
  accessoryModelId: string
  tx: Prisma.TransactionClient
}) {
  if (params.phoneModelId === params.accessoryModelId) {
    throw new Error("Los modelos deben ser diferentes.")
  }

  const [phoneModel, accessoryModel] = await Promise.all([
    params.tx.productCatalogModel.findFirst({
      where: { id: params.phoneModelId, tenantId: params.tenantId },
      select: { id: true, type: true, name: true },
    }),
    params.tx.productCatalogModel.findFirst({
      where: { id: params.accessoryModelId, tenantId: params.tenantId },
      select: { id: true, type: true, name: true },
    }),
  ])

  if (!phoneModel || !accessoryModel) {
    throw new Error("Los modelos no pertenecen al tenant actual.")
  }
  if (phoneModel.type !== "PHONE") {
    throw new Error("Solo un modelo PHONE puede ser origen de compatibilidad.")
  }
  if (accessoryModel.type !== "ACCESSORY") {
    throw new Error("Solo un modelo ACCESSORY puede ser accesorio compatible.")
  }

  return { phoneModel, accessoryModel }
}

export async function listCompatibilities(params: {
  tenantId: string
  phoneModelId?: string | null
  accessoryModelId?: string | null
  active?: boolean | null
}) {
  return prisma.productModelCompatibility.findMany({
    where: {
      tenantId: params.tenantId,
      ...(params.phoneModelId ? { phoneModelId: params.phoneModelId } : {}),
      ...(params.accessoryModelId ? { accessoryModelId: params.accessoryModelId } : {}),
      ...(params.active == null ? {} : { isActive: params.active }),
    },
    include: {
      phoneModel: { select: { id: true, name: true, type: true } },
      accessoryModel: { select: { id: true, name: true, type: true } },
    },
    orderBy: [{ sortOrder: "asc" }, { accessoryModel: { name: "asc" } }],
  })
}

export async function createCompatibility(params: {
  tenantId: string
  actorUserId: string
  actorRole: UserRole
  phoneModelId: string
  accessoryModelId: string
  sortOrder?: number
}) {
  return prisma.$transaction(async (tx) => {
    await assertCompatibilityModels({ ...params, tx })

    const current = await tx.productModelCompatibility.findUnique({
      where: {
        tenantId_phoneModelId_accessoryModelId: {
          tenantId: params.tenantId,
          phoneModelId: params.phoneModelId,
          accessoryModelId: params.accessoryModelId,
        },
      },
    })

    const compatibility = current
      ? await tx.productModelCompatibility.update({
          where: { id: current.id },
          data: { isActive: true, sortOrder: params.sortOrder ?? current.sortOrder },
        })
      : await tx.productModelCompatibility.create({
          data: {
            tenantId: params.tenantId,
            phoneModelId: params.phoneModelId,
            accessoryModelId: params.accessoryModelId,
            sortOrder: params.sortOrder ?? 0,
          },
        })

    await createAuditLog({
      tenantId: params.tenantId,
      actorUserId: params.actorUserId,
      actorRole: params.actorRole,
      action: "CREATE",
      module: "CATALOG",
      entityType: "ProductModelCompatibility",
      entityId: compatibility.id,
      detail: "Compatibilidad creada/reactivada",
      oldValue: current as Prisma.InputJsonValue,
      newValue: compatibility as Prisma.InputJsonValue,
    }, tx)

    return compatibility
  })
}

export async function replacePhoneCompatibilities(params: {
  tenantId: string
  actorUserId: string
  actorRole: UserRole
  phoneModelId: string
  accessoryModelIds: string[]
}) {
  return prisma.$transaction(async (tx) => {
    const uniqueAccessoryIds = Array.from(new Set(params.accessoryModelIds))
    for (const accessoryModelId of uniqueAccessoryIds) {
      await assertCompatibilityModels({
        tenantId: params.tenantId,
        phoneModelId: params.phoneModelId,
        accessoryModelId,
        tx,
      })
    }

    const current = await tx.productModelCompatibility.findMany({
      where: { tenantId: params.tenantId, phoneModelId: params.phoneModelId },
    })
    const selected = new Set(uniqueAccessoryIds)
    const currentByAccessory = new Map(current.map((item) => [item.accessoryModelId, item]))
    const touched = []

    for (const [index, accessoryModelId] of uniqueAccessoryIds.entries()) {
      const existing = currentByAccessory.get(accessoryModelId)
      if (existing) {
        touched.push(await tx.productModelCompatibility.update({
          where: { id: existing.id },
          data: { isActive: true, sortOrder: index },
        }))
      } else {
        touched.push(await tx.productModelCompatibility.create({
          data: {
            tenantId: params.tenantId,
            phoneModelId: params.phoneModelId,
            accessoryModelId,
            sortOrder: index,
          },
        }))
      }
    }

    const removedIds = current
      .filter((item) => item.isActive && !selected.has(item.accessoryModelId))
      .map((item) => item.id)

    if (removedIds.length) {
      await tx.productModelCompatibility.updateMany({
        where: { id: { in: removedIds }, tenantId: params.tenantId },
        data: { isActive: false },
      })
    }

    await createAuditLog({
      tenantId: params.tenantId,
      actorUserId: params.actorUserId,
      actorRole: params.actorRole,
      action: "UPDATE",
      module: "CATALOG",
      entityType: "ProductModelCompatibility",
      entityId: params.phoneModelId,
      detail: "Compatibilidades de modelo actualizadas",
      oldValue: current as Prisma.InputJsonValue,
      newValue: { phoneModelId: params.phoneModelId, accessoryModelIds: uniqueAccessoryIds } as Prisma.InputJsonValue,
      metadata: { deactivated: removedIds.length, active: uniqueAccessoryIds.length },
    }, tx)

    return { active: touched.length, deactivated: removedIds.length }
  })
}

export async function updateCompatibility(params: {
  tenantId: string
  actorUserId: string
  actorRole: UserRole
  id: string
  sortOrder?: number
  isActive?: boolean
}) {
  return prisma.$transaction(async (tx) => {
    const current = await tx.productModelCompatibility.findFirst({ where: { id: params.id, tenantId: params.tenantId } })
    if (!current) throw new Error("Compatibilidad no encontrada.")
    const updated = await tx.productModelCompatibility.update({
      where: { id: current.id },
      data: {
        sortOrder: params.sortOrder ?? current.sortOrder,
        isActive: params.isActive ?? current.isActive,
      },
    })

    await createAuditLog({
      tenantId: params.tenantId,
      actorUserId: params.actorUserId,
      actorRole: params.actorRole,
      action: "UPDATE",
      module: "CATALOG",
      entityType: "ProductModelCompatibility",
      entityId: updated.id,
      detail: "Compatibilidad actualizada",
      oldValue: current as Prisma.InputJsonValue,
      newValue: updated as Prisma.InputJsonValue,
    }, tx)

    return updated
  })
}

export async function deleteCompatibility(params: {
  tenantId: string
  actorUserId: string
  actorRole: UserRole
  id: string
}) {
  return prisma.$transaction(async (tx) => {
    const current = await tx.productModelCompatibility.findFirst({ where: { id: params.id, tenantId: params.tenantId } })
    if (!current) throw new Error("Compatibilidad no encontrada.")
    const updated = await tx.productModelCompatibility.update({
      where: { id: current.id },
      data: { isActive: false },
    })

    await createAuditLog({
      tenantId: params.tenantId,
      actorUserId: params.actorUserId,
      actorRole: params.actorRole,
      action: "DELETE",
      module: "CATALOG",
      entityType: "ProductModelCompatibility",
      entityId: updated.id,
      detail: "Compatibilidad desactivada",
      oldValue: current as Prisma.InputJsonValue,
      newValue: updated as Prisma.InputJsonValue,
    }, tx)

    return updated
  })
}

function productIsSellable(product: { state: string; status: string; senado: boolean; stockAvailable: number }) {
  return (
    product.status === "AVAILABLE" &&
    !product.senado &&
    SELLABLE_STATES.includes(product.state as (typeof SELLABLE_STATES)[number]) &&
    product.stockAvailable > 0
  )
}

export async function getCompatibleAccessorySuggestions(params: {
  tenantId: string
  phoneProductId: string
  branchId?: string | null
  saleType?: SaleType | "MINORISTA" | "MAYORISTA" | null
  canSeeFinancials?: boolean
}): Promise<CompatibleAccessorySuggestion[]> {
  const phone = await prisma.product.findFirst({
    where: { id: params.phoneProductId, tenantId: params.tenantId },
    select: {
      id: true,
      tenantId: true,
      type: true,
      modelName: true,
      catalogModelId: true,
    },
  })

  if (!phone) throw new Error("Producto no encontrado.")
  if (phone.type !== "PHONE") throw new Error("El producto debe ser PHONE.")

  let phoneCatalogModelId = phone.catalogModelId
  if (!phoneCatalogModelId) {
    const legacyModel = await prisma.productCatalogModel.findFirst({
      where: {
        tenantId: params.tenantId,
        type: "PHONE",
        normalizedName: normalizeCatalogValue(phone.modelName),
      },
      select: { id: true },
    })
    phoneCatalogModelId = legacyModel?.id ?? null
  }

  if (!phoneCatalogModelId) return []

  const compatibilities = await prisma.productModelCompatibility.findMany({
    where: { tenantId: params.tenantId, phoneModelId: phoneCatalogModelId, isActive: true },
    include: {
      accessoryModel: { select: { id: true, name: true } },
    },
    orderBy: [{ sortOrder: "asc" }, { accessoryModel: { name: "asc" } }],
  })

  if (!compatibilities.length) return []

  const settings = await ensureTenantSettings(params.tenantId)
  const accessoryModelIds = compatibilities.map((item) => item.accessoryModelId)

  const products = await prisma.product.findMany({
    where: {
      tenantId: params.tenantId,
      type: "ACCESSORY",
      catalogModelId: { in: accessoryModelIds },
      ...(params.branchId ? { OR: [{ branchId: params.branchId }, { branchId: null }] } : {}),
    },
    select: {
      id: true,
      tenantId: true,
      type: true,
      brand: true,
      imei: true,
      modelName: true,
      capacityGB: true,
      condition: true,
      color: true,
      batteryPct: true,
      purchaseDate: true,
      catalogModelId: true,
      costPrice: true,
      salePrice: true,
      wholesalePrice: true,
      shippingCost: true,
      state: true,
      status: true,
      senado: true,
      senadoAt: true,
      stockInitial: true,
      stockAvailable: true,
      stock: true,
      location: true,
      branchId: true,
      notes: true,
      origin: true,
      createdAt: true,
      updatedAt: true,
    },
  })

  const grouped = new Map<string, CompatibleAccessorySuggestion>()
  const modelNameById = new Map(compatibilities.map((item) => [item.accessoryModelId, item.accessoryModel.name]))
  const saleType = params.saleType === "MAYORISTA" ? "MAYORISTA" : "MINORISTA"

  for (const product of products) {
    if (!product.catalogModelId || !productIsSellable(product)) continue

    const current = grouped.get(product.catalogModelId)
    const unitPrice =
      saleType === "MAYORISTA" && settings.wholesalePricesEnabled
        ? product.wholesalePrice ?? product.salePrice
        : product.salePrice
    const serializedProduct = {
      id: product.id,
      tenantId: product.tenantId,
      type: "ACCESSORY" as const,
      brand: product.brand,
      imei: product.imei,
      modelName: product.modelName,
      catalogModelId: product.catalogModelId,
      capacityGB: product.capacityGB,
      condition: product.condition,
      color: product.color,
      batteryPct: product.batteryPct,
      purchaseDate: product.purchaseDate ? product.purchaseDate.toISOString() : null,
      costPrice: params.canSeeFinancials ? String(product.costPrice) : null,
      salePrice: String(unitPrice),
      wholesalePrice: product.wholesalePrice == null ? null : String(product.wholesalePrice),
      shippingCost: params.canSeeFinancials && product.shippingCost != null ? String(product.shippingCost) : null,
      state: product.state,
      senado: product.senado,
      senadoAt: product.senadoAt ? product.senadoAt.toISOString() : null,
      status: product.status,
      stockInitial: product.stockInitial,
      stock: product.stock,
      stockAvailable: product.stockAvailable,
      location: product.location,
      branchId: product.branchId,
      notes: product.notes,
      origin: product.origin,
      createdAt: product.createdAt ? product.createdAt.toISOString() : null,
      updatedAt: product.updatedAt ? product.updatedAt.toISOString() : null,
    }

    if (!current) {
      grouped.set(product.catalogModelId, {
        catalogModelId: product.catalogModelId,
        modelName: modelNameById.get(product.catalogModelId) ?? product.modelName,
        stockAvailable: product.stockAvailable,
        suggestedUnitPrice: String(unitPrice),
        productIds: [product.id],
        products: [serializedProduct],
      })
    } else {
      current.stockAvailable += product.stockAvailable
      current.productIds.push(product.id)
      current.products.push(serializedProduct)
      if (new Prisma.Decimal(unitPrice).lessThan(current.suggestedUnitPrice)) {
        current.suggestedUnitPrice = String(unitPrice)
      }
    }
  }

  return Array.from(grouped.values()).sort((a, b) => {
    const aIndex = accessoryModelIds.indexOf(a.catalogModelId)
    const bIndex = accessoryModelIds.indexOf(b.catalogModelId)
    if (aIndex !== bIndex) return aIndex - bIndex
    return a.modelName.localeCompare(b.modelName)
  })
}
