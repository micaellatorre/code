import { PrismaClient } from "@prisma/client"
import {
  ACCESSORY_MODEL_ALIASES,
  BASE_COLORS,
  DEVICE_MODEL_ALIASES,
} from "@/lib/config/baseCatalogs"
import { normalizeCatalogValue } from "@/lib/config/normalizeCatalogValue"

const prisma = new PrismaClient()

type ProductTypeValue = "PHONE" | "ACCESSORY"
type CatalogRef = { id: string; label: string }
type ProductRow = {
  id: string
  type: ProductTypeValue
  modelName: string
  capacityGB: number | null
  color: string | null
  catalogModelId: string | null
  catalogCapacityId: string | null
  catalogColorId: string | null
}

type ProductUpdate = {
  productId: string
  modelName: string
  type: ProductTypeValue
  data: {
    catalogModelId?: string
    catalogCapacityId?: string
    catalogColorId?: string
  }
}

function readArg(name: string) {
  const index = process.argv.indexOf(name)
  if (index === -1) return null
  return process.argv[index + 1] ?? null
}

function parseType(value: string | null): ProductTypeValue[] {
  const normalized = value?.trim().toUpperCase()
  if (!normalized || normalized === "ALL") return ["PHONE", "ACCESSORY"]
  if (normalized === "PHONE" || normalized === "ACCESSORY") return [normalized]
  throw new Error("--type debe ser PHONE, ACCESSORY o ALL.")
}

function parseLimit(value: string | null) {
  if (!value) return undefined
  const limit = Number(value)
  if (!Number.isInteger(limit) || limit < 1) throw new Error("--limit debe ser un entero positivo.")
  return limit
}

function putUnique(
  map: Map<string, CatalogRef>,
  key: string,
  ref: CatalogRef,
  warnings: string[],
) {
  const normalized = normalizeCatalogValue(key)
  if (!normalized) return

  const existing = map.get(normalized)
  if (existing && existing.id !== ref.id) {
    warnings.push(`Clave normalizada duplicada "${normalized}" para ${existing.label} (${existing.id}) y ${ref.label} (${ref.id}).`)
    return
  }

  map.set(normalized, ref)
}

async function resolveTenantId() {
  const explicit = readArg("--tenant-id")?.trim()
  const configured = process.env.DEFAULT_TENANT_ID?.trim()
  const tenantId = explicit || configured

  if (!tenantId) {
    throw new Error("Uso: node scripts/run-ts-script.cjs scripts/link-products-to-catalogs.ts --tenant-id <id> [--apply] [--overwrite] [--type PHONE|ACCESSORY|ALL] [--limit n]")
  }

  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { id: true, name: true } })
  if (!tenant) throw new Error(`No existe el tenant ${tenantId}.`)
  return tenant
}

async function buildModelMap(tenantId: string, warnings: string[]) {
  const rows = await prisma.productCatalogModel.findMany({
    where: { tenantId, isActive: true },
    select: { id: true, type: true, name: true, normalizedName: true },
    orderBy: [{ type: "asc" }, { name: "asc" }],
  })

  const map = new Map<string, CatalogRef>()
  const byTypeAndName = new Map<string, CatalogRef>()

  for (const row of rows) {
    const type = String(row.type).toUpperCase()
    const ref = { id: row.id, label: `${type}:${row.name}` }
    putUnique(map, `${type}:${row.normalizedName}`, ref, warnings)
    putUnique(map, `${type}:${row.name}`, ref, warnings)
    byTypeAndName.set(`${type}:${normalizeCatalogValue(row.name)}`, ref)
  }

  for (const alias of DEVICE_MODEL_ALIASES) {
    const target = byTypeAndName.get(`PHONE:${normalizeCatalogValue(alias.target)}`)
    if (target) putUnique(map, `PHONE:${alias.alias}`, target, warnings)
    else warnings.push(`Alias de equipo "${alias.alias}" apunta a "${alias.target}", pero el catalogo activo no contiene ese destino.`)
  }

  for (const alias of ACCESSORY_MODEL_ALIASES) {
    const target = byTypeAndName.get(`ACCESSORY:${normalizeCatalogValue(alias.target)}`)
    if (target) putUnique(map, `ACCESSORY:${alias.alias}`, target, warnings)
    else warnings.push(`Alias de accesorio "${alias.alias}" apunta a "${alias.target}", pero el catalogo activo no contiene ese destino.`)
  }

  return map
}

async function buildCapacityMap(tenantId: string) {
  const rows = await prisma.productCatalogCapacity.findMany({
    where: { tenantId, isActive: true },
    select: { id: true, capacityGB: true, label: true },
  })

  return new Map(rows.map((row) => [row.capacityGB, { id: row.id, label: row.label } satisfies CatalogRef]))
}

async function buildColorMap(tenantId: string, warnings: string[]) {
  const rows = await prisma.productCatalogColor.findMany({
    where: { tenantId, isActive: true },
    select: {
      id: true,
      name: true,
      normalizedName: true,
      aliases: { select: { alias: true, normalizedAlias: true } },
    },
  })

  const map = new Map<string, CatalogRef>()
  const byName = new Map<string, CatalogRef>()

  for (const row of rows) {
    const ref = { id: row.id, label: row.name }
    putUnique(map, row.normalizedName, ref, warnings)
    putUnique(map, row.name, ref, warnings)
    byName.set(normalizeCatalogValue(row.name), ref)

    for (const alias of row.aliases) {
      putUnique(map, alias.normalizedAlias || alias.alias, ref, warnings)
    }
  }

  for (const baseColor of BASE_COLORS) {
    const target = byName.get(normalizeCatalogValue(baseColor.name))
    if (!target) continue

    for (const alias of baseColor.aliases) {
      putUnique(map, alias, target, warnings)
    }
  }

  return map
}

function getModelMatch(map: Map<string, CatalogRef>, product: ProductRow) {
  return map.get(`${product.type}:${normalizeCatalogValue(product.modelName)}`) ?? null
}

function getColorMatch(map: Map<string, CatalogRef>, color: string | null) {
  if (!color?.trim()) return null
  return map.get(normalizeCatalogValue(color)) ?? null
}

function applyField(
  params: {
    product: ProductRow
    fieldName: keyof ProductUpdate["data"]
    currentId: string | null
    target: CatalogRef | null
    overwrite: boolean
    conflicts: string[]
  },
) {
  if (!params.target) return null
  if (params.currentId === params.target.id) return null

  if (params.currentId && !params.overwrite) {
    params.conflicts.push(
      `${params.product.id} (${params.product.modelName}) ya tiene ${params.fieldName}=${params.currentId}; match propuesto ${params.target.id}. Usa --overwrite para reemplazarlo.`,
    )
    return null
  }

  return params.target.id
}

async function main() {
  const apply = process.argv.includes("--apply")
  const overwrite = process.argv.includes("--overwrite")
  const types = parseType(readArg("--type"))
  const limit = parseLimit(readArg("--limit"))
  const tenant = await resolveTenantId()

  const warnings: string[] = []
  const conflicts: string[] = []
  const [modelMap, capacityMap, colorMap] = await Promise.all([
    buildModelMap(tenant.id, warnings),
    buildCapacityMap(tenant.id),
    buildColorMap(tenant.id, warnings),
  ])

  const products = await prisma.product.findMany({
    where: { tenantId: tenant.id, type: { in: types as any } },
    select: {
      id: true,
      type: true,
      modelName: true,
      capacityGB: true,
      color: true,
      catalogModelId: true,
      catalogCapacityId: true,
      catalogColorId: true,
    },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    ...(limit ? { take: limit } : {}),
  }) as ProductRow[]

  const updates: ProductUpdate[] = []
  let matchedModels = 0
  let unmatchedModels = 0
  let matchedCapacities = 0
  let unmatchedCapacities = 0
  let matchedColors = 0
  let unmatchedColors = 0

  for (const product of products) {
    const modelMatch = getModelMatch(modelMap, product)
    const capacityMatch = product.capacityGB == null ? null : capacityMap.get(product.capacityGB) ?? null
    const colorMatch = getColorMatch(colorMap, product.color)

    if (modelMatch) matchedModels += 1
    else unmatchedModels += 1

    if (product.capacityGB == null) {
      unmatchedCapacities += 1
    } else if (capacityMatch) {
      matchedCapacities += 1
    } else {
      unmatchedCapacities += 1
    }

    if (!product.color?.trim()) {
      unmatchedColors += 1
    } else if (colorMatch) {
      matchedColors += 1
    } else {
      unmatchedColors += 1
    }

    const data: ProductUpdate["data"] = {}
    const nextModelId = applyField({
      product,
      fieldName: "catalogModelId",
      currentId: product.catalogModelId,
      target: modelMatch,
      overwrite,
      conflicts,
    })
    const nextCapacityId = applyField({
      product,
      fieldName: "catalogCapacityId",
      currentId: product.catalogCapacityId,
      target: capacityMatch,
      overwrite,
      conflicts,
    })
    const nextColorId = applyField({
      product,
      fieldName: "catalogColorId",
      currentId: product.catalogColorId,
      target: colorMatch,
      overwrite,
      conflicts,
    })

    if (nextModelId) data.catalogModelId = nextModelId
    if (nextCapacityId) data.catalogCapacityId = nextCapacityId
    if (nextColorId) data.catalogColorId = nextColorId

    if (Object.keys(data).length > 0) {
      updates.push({ productId: product.id, modelName: product.modelName, type: product.type, data })
    }
  }

  if (apply && updates.length > 0) {
    await prisma.$transaction(async (tx) => {
      for (const update of updates) {
        await tx.product.update({
          where: { id: update.productId },
          data: update.data,
        })
      }
    })
  }

  console.log(JSON.stringify({
    mode: apply ? "applied" : "dry-run",
    tenant: { id: tenant.id, name: tenant.name },
    overwrite,
    productTypes: types,
    productsScanned: products.length,
    productsWithPendingUpdates: updates.length,
    productsUpdated: apply ? updates.length : 0,
    matched: {
      models: matchedModels,
      capacities: matchedCapacities,
      colors: matchedColors,
    },
    unmatched: {
      models: unmatchedModels,
      capacities: unmatchedCapacities,
      colors: unmatchedColors,
    },
    pendingUpdates: updates.slice(0, 100),
    warnings,
    conflicts,
  }, null, 2))
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
