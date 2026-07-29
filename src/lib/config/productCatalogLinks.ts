import type { ProductType, UserRole } from "@prisma/client"
import prisma from "@/lib/prisma"
import { ensureTenantSettings } from "@/lib/config/settings"

function hasOwn(input: Record<string, unknown>, key: string) {
  return Object.prototype.hasOwnProperty.call(input, key)
}

function cleanOptionalId(value: unknown) {
  if (value == null) return null
  const text = String(value).trim()
  return text || null
}

export async function buildProductCatalogUpdate(
  tenantId: string,
  input: Record<string, unknown>,
  productType?: ProductType | string | null,
) {
  const data: Record<string, unknown> = {}

  if (hasOwn(input, "catalogModelId")) {
    const catalogModelId = cleanOptionalId(input.catalogModelId)
    if (!catalogModelId) {
      data.catalogModelId = null
    } else {
      const model = await prisma.productCatalogModel.findFirst({
        where: {
          id: catalogModelId,
          tenantId,
          ...(productType ? { type: productType as ProductType } : {}),
        },
        select: { id: true, name: true, type: true },
      })
      if (!model) throw new Error("Modelo de catalogo no disponible.")
      data.catalogModelId = model.id
      data.modelName = model.name
    }
  }

  if (hasOwn(input, "catalogCapacityId")) {
    const catalogCapacityId = cleanOptionalId(input.catalogCapacityId)
    if (!catalogCapacityId) {
      data.catalogCapacityId = null
    } else {
      const capacity = await prisma.productCatalogCapacity.findFirst({
        where: { id: catalogCapacityId, tenantId },
        select: { id: true, capacityGB: true },
      })
      if (!capacity) throw new Error("Capacidad de catalogo no disponible.")
      data.catalogCapacityId = capacity.id
      data.capacityGB = capacity.capacityGB
    }
  }

  if (hasOwn(input, "catalogColorId")) {
    const catalogColorId = cleanOptionalId(input.catalogColorId)
    if (!catalogColorId) {
      data.catalogColorId = null
    } else {
      const color = await prisma.productCatalogColor.findFirst({
        where: { id: catalogColorId, tenantId },
        select: { id: true, name: true },
      })
      if (!color) throw new Error("Color de catalogo no disponible.")
      data.catalogColorId = color.id
      data.color = color.name
    }
  }

  return data
}

export async function buildWholesalePriceUpdate(params: {
  tenantId: string
  actorRole: UserRole | string
  input: Record<string, unknown>
}) {
  if (!hasOwn(params.input, "wholesalePrice")) return {}

  if (params.actorRole !== "ADMIN") {
    throw new Error("Solo ADMIN puede modificar el precio mayorista.")
  }

  const raw = params.input.wholesalePrice
  if (raw == null || String(raw).trim() === "") {
    return { wholesalePrice: null }
  }

  const settings = await ensureTenantSettings(params.tenantId)
  if (!settings.wholesalePricesEnabled) {
    throw new Error("El precio mayorista no esta habilitado para este tenant.")
  }

  const value = Number(raw)
  if (!Number.isFinite(value) || value < 0) {
    throw new Error("Precio mayorista invalido.")
  }

  return { wholesalePrice: String(value) }
}
