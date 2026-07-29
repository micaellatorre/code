import { Prisma, type ProductType, type UserRole } from "@prisma/client"
import prisma from "@/lib/prisma"
import { createAuditLog } from "@/lib/domain/audit"
import {
  BASE_ACCESSORY_MODELS,
  BASE_CAPACITIES,
  BASE_COLORS,
  BASE_DEVICE_MODELS,
  BASE_LOAD_COUNTS,
  BASE_MEASURES,
  COMPATIBLE_IPHONE_MODELS,
  type BaseLoadCategory,
} from "@/lib/config/baseCatalogs"
import { normalizeCatalogValue } from "@/lib/config/normalizeCatalogValue"

export type CatalogCategory = "models" | "capacities" | "measures" | "colors"

export type BaseLoadResult = {
  category: BaseLoadCategory
  created: number
  existing: number
  skipped: number
  attempted: number
  createdModels?: number
  existingModels?: number
  createdCompatibilities: number
  existingCompatibilities: number
  skippedCompatibilities: number
}

export function assertBaseLoadCategory(value: unknown): BaseLoadCategory {
  if (
    value === "devices" ||
    value === "accessories" ||
    value === "capacities" ||
    value === "measures" ||
    value === "colors"
  ) {
    return value
  }
  throw new Error("Categoria de carga base invalida.")
}

export function assertCatalogCategory(value: unknown): CatalogCategory {
  if (value === "models" || value === "capacities" || value === "measures" || value === "colors") {
    return value
  }
  throw new Error("Categoria de catalogo invalida.")
}

export function assertCatalogProductType(value: unknown): ProductType {
  if (value === "PHONE" || value === "ACCESSORY") return value
  throw new Error("Tipo de producto invalido.")
}

function assertHexColor(value: string) {
  if (!/^#[0-9A-Fa-f]{6}$/.test(value)) {
    throw new Error("El color hexadecimal debe tener formato #RRGGBB.")
  }
}

function baseModelsForCategory(category: BaseLoadCategory) {
  if (category === "devices") {
    return { type: "PHONE" as const, models: BASE_DEVICE_MODELS }
  }
  if (category === "accessories") {
    return { type: "ACCESSORY" as const, models: BASE_ACCESSORY_MODELS }
  }
  return null
}

async function loadBaseModels(
  tenantId: string,
  type: ProductType,
  models: readonly string[],
  tx: Prisma.TransactionClient,
) {
  const normalizedNames = models.map(normalizeCatalogValue)
  const existing = await tx.productCatalogModel.findMany({
    where: { tenantId, type, normalizedName: { in: normalizedNames } },
    select: { normalizedName: true },
  })
  const existingSet = new Set(existing.map((item) => item.normalizedName))
  const data = models.map((name, sortOrder) => ({
    tenantId,
    type,
    name,
    normalizedName: normalizeCatalogValue(name),
    source: "BASE" as const,
    sortOrder,
  }))

  const created = await tx.productCatalogModel.createMany({
    data,
    skipDuplicates: true,
  })

  return {
    created: created.count,
    existing: data.filter((item) => existingSet.has(item.normalizedName)).length,
    skipped: 0,
  }
}

async function loadBaseCapacities(tenantId: string, tx: Prisma.TransactionClient) {
  const values = BASE_CAPACITIES.map((capacity) => capacity.capacityGB)
  const existing = await tx.productCatalogCapacity.findMany({
    where: { tenantId, capacityGB: { in: values as unknown as number[] } },
    select: { capacityGB: true },
  })
  const existingSet = new Set(existing.map((item) => item.capacityGB))
  const data = BASE_CAPACITIES.map((capacity, sortOrder) => ({
    tenantId,
    capacityGB: capacity.capacityGB,
    label: capacity.label,
    source: "BASE" as const,
    sortOrder,
  }))
  const created = await tx.productCatalogCapacity.createMany({ data, skipDuplicates: true })

  return {
    created: created.count,
    existing: data.filter((item) => existingSet.has(item.capacityGB)).length,
    skipped: 0,
  }
}

async function loadBaseMeasures(tenantId: string, tx: Prisma.TransactionClient) {
  const data = BASE_MEASURES.map((measure, sortOrder) => ({
    tenantId,
    label: measure.label,
    millimeters: new Prisma.Decimal(measure.millimeters),
    source: "BASE" as const,
    sortOrder,
  }))

  if (data.length === 0) return { created: 0, existing: 0, skipped: 0 }

  const existing = await tx.productCatalogMeasure.findMany({
    where: { tenantId, millimeters: { in: data.map((item) => item.millimeters) } },
    select: { millimeters: true },
  })
  const existingSet = new Set(existing.map((item) => String(item.millimeters)))
  const created = await tx.productCatalogMeasure.createMany({ data, skipDuplicates: true })

  return {
    created: created.count,
    existing: data.filter((item) => existingSet.has(String(item.millimeters))).length,
    skipped: 0,
  }
}

async function loadBaseColors(tenantId: string, tx: Prisma.TransactionClient) {
  const normalizedAliasTargets = new Map<string, string>()
  for (const color of BASE_COLORS) {
    for (const alias of color.aliases) {
      const normalizedAlias = normalizeCatalogValue(alias)
      const currentTarget = normalizedAliasTargets.get(normalizedAlias)
      if (currentTarget && currentTarget !== color.name) {
        throw new Error(`Alias duplicado en catalogo base: ${alias}`)
      }
      normalizedAliasTargets.set(normalizedAlias, color.name)
    }
  }

  const existingAliases = await tx.productCatalogColorAlias.findMany({
    where: { tenantId, normalizedAlias: { in: Array.from(normalizedAliasTargets.keys()) } },
    select: {
      normalizedAlias: true,
      color: { select: { normalizedName: true, name: true } },
    },
  })

  for (const alias of existingAliases) {
    const targetName = normalizedAliasTargets.get(alias.normalizedAlias)
    if (targetName && alias.color.normalizedName !== normalizeCatalogValue(targetName)) {
      throw new Error(`El alias "${alias.normalizedAlias}" ya pertenece a ${alias.color.name}.`)
    }
  }

  let created = 0
  let existing = 0
  let createdAliases = 0

  for (const color of BASE_COLORS) {
    const normalizedName = normalizeCatalogValue(color.name)
    const current = await tx.productCatalogColor.findUnique({
      where: { tenantId_normalizedName: { tenantId, normalizedName } },
      select: { id: true },
    })

    const row = current
      ? await tx.productCatalogColor.update({
          where: { id: current.id },
          data: { hexColor: color.hexColor },
          select: { id: true },
        })
      : await tx.productCatalogColor.create({
          data: {
            tenantId,
            name: color.name,
            normalizedName,
            hexColor: color.hexColor,
            source: "BASE",
            sortOrder: BASE_COLORS.findIndex((item) => item.name === color.name),
          },
          select: { id: true },
        })

    if (current) existing += 1
    else created += 1

    const aliasRows = color.aliases.map((alias) => ({
      tenantId,
      colorId: row.id,
      alias,
      normalizedAlias: normalizeCatalogValue(alias),
    }))
    const aliasCreate = await tx.productCatalogColorAlias.createMany({
      data: aliasRows,
      skipDuplicates: true,
    })
    createdAliases += aliasCreate.count
  }

  return { created, existing, skipped: 0, createdAliases }
}

export async function ensureGeneratedAccessoryCompatibilities(
  tenantId: string,
  tx: Prisma.TransactionClient,
) {
  const phoneNormalizedNames = COMPATIBLE_IPHONE_MODELS.map(normalizeCatalogValue)
  const accessoryNormalizedNames = COMPATIBLE_IPHONE_MODELS.flatMap((phoneName) => [
    normalizeCatalogValue(`Funda ${phoneName}`),
    normalizeCatalogValue(`Vidrio Templado ${phoneName}`),
  ])

  const [phones, accessories] = await Promise.all([
    tx.productCatalogModel.findMany({
      where: {
        tenantId,
        type: "PHONE",
        normalizedName: { in: phoneNormalizedNames },
      },
      select: { id: true, normalizedName: true },
    }),
    tx.productCatalogModel.findMany({
      where: {
        tenantId,
        type: "ACCESSORY",
        normalizedName: { in: accessoryNormalizedNames },
      },
      select: { id: true, normalizedName: true },
    }),
  ])

  const phoneByName = new Map(phones.map((phone) => [phone.normalizedName, phone]))
  const accessoryByName = new Map(accessories.map((accessory) => [accessory.normalizedName, accessory]))
  const desired: Array<{ tenantId: string; phoneModelId: string; accessoryModelId: string }> = []
  let skippedCompatibilities = 0

  for (const phoneName of COMPATIBLE_IPHONE_MODELS) {
    const phone = phoneByName.get(normalizeCatalogValue(phoneName))

    if (!phone) {
      skippedCompatibilities += 2
      continue
    }

    const accessoryNames = [`Funda ${phoneName}`, `Vidrio Templado ${phoneName}`]
    for (const accessoryName of accessoryNames) {
      const accessory = accessoryByName.get(normalizeCatalogValue(accessoryName))

      if (!accessory) {
        skippedCompatibilities += 1
        continue
      }

      desired.push({ tenantId, phoneModelId: phone.id, accessoryModelId: accessory.id })
    }
  }

  if (desired.length === 0) {
    return { createdCompatibilities: 0, existingCompatibilities: 0, skippedCompatibilities }
  }

  const existing = await tx.productModelCompatibility.findMany({
    where: {
      tenantId,
      OR: desired.map((item) => ({
        phoneModelId: item.phoneModelId,
        accessoryModelId: item.accessoryModelId,
      })),
    },
    select: { id: true, phoneModelId: true, accessoryModelId: true, isActive: true },
  })
  const existingKeys = new Set(existing.map((item) => `${item.phoneModelId}:${item.accessoryModelId}`))
  const inactiveIds = existing.filter((item) => !item.isActive).map((item) => item.id)
  if (inactiveIds.length > 0) {
    await tx.productModelCompatibility.updateMany({
      where: { id: { in: inactiveIds } },
      data: { isActive: true },
    })
  }

  const createRows = desired.filter((item) => !existingKeys.has(`${item.phoneModelId}:${item.accessoryModelId}`))
  const created = createRows.length
    ? await tx.productModelCompatibility.createMany({ data: createRows, skipDuplicates: true })
    : { count: 0 }

  return {
    createdCompatibilities: created.count,
    existingCompatibilities: existing.length,
    skippedCompatibilities,
  }
}

export async function loadBaseCatalog(params: {
  tenantId: string
  category: BaseLoadCategory
  actorUserId: string
  actorRole: UserRole
}) {
  return prisma.$transaction(async (tx) => {
    const attempted = BASE_LOAD_COUNTS[params.category]
    let counts = { created: 0, existing: 0, skipped: 0 }

    const modelLoad = baseModelsForCategory(params.category)
    if (modelLoad) {
      counts = await loadBaseModels(params.tenantId, modelLoad.type, modelLoad.models, tx)
    } else if (params.category === "capacities") {
      counts = await loadBaseCapacities(params.tenantId, tx)
    } else if (params.category === "measures") {
      counts = await loadBaseMeasures(params.tenantId, tx)
    } else if (params.category === "colors") {
      counts = await loadBaseColors(params.tenantId, tx)
    }

    const compatibilityCounts =
      params.category === "devices" || params.category === "accessories"
        ? await ensureGeneratedAccessoryCompatibilities(params.tenantId, tx)
        : { createdCompatibilities: 0, existingCompatibilities: 0, skippedCompatibilities: 0 }

    const result: BaseLoadResult = {
      category: params.category,
      attempted,
      ...counts,
      createdModels: modelLoad ? counts.created : undefined,
      existingModels: modelLoad ? counts.existing : undefined,
      ...compatibilityCounts,
    }

    await createAuditLog({
      tenantId: params.tenantId,
      actorUserId: params.actorUserId,
      actorRole: params.actorRole,
      action: "CREATE",
      module: "CATALOG",
      entityType: "BaseCatalogLoad",
      entityId: params.category,
      detail: `Carga base de catalogo: ${params.category}`,
      newValue: result as unknown as Prisma.InputJsonValue,
    }, tx)

    return result
  }, { timeout: 15000, maxWait: 5000 })
}

export async function getCatalogSnapshot(tenantId: string) {
  const [models, capacities, measures, colors, compatibilities] = await Promise.all([
    prisma.productCatalogModel.findMany({
      where: { tenantId },
      orderBy: [{ type: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
      include: {
        _count: {
          select: {
            products: true,
            accessoryCompatibilities: { where: { isActive: true } },
            phoneCompatibilities: { where: { isActive: true } },
          },
        },
      },
    }),
    prisma.productCatalogCapacity.findMany({
      where: { tenantId },
      orderBy: [{ sortOrder: "asc" }, { capacityGB: "asc" }],
      include: { _count: { select: { products: true } } },
    }),
    prisma.productCatalogMeasure.findMany({
      where: { tenantId },
      orderBy: [{ sortOrder: "asc" }, { millimeters: "asc" }],
    }),
    prisma.productCatalogColor.findMany({
      where: { tenantId },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: { aliases: { orderBy: { alias: "asc" } }, _count: { select: { products: true } } },
    }),
    prisma.productModelCompatibility.findMany({
      where: { tenantId, isActive: true },
      include: {
        phoneModel: { select: { id: true, name: true } },
        accessoryModel: { select: { id: true, name: true } },
      },
      orderBy: [{ sortOrder: "asc" }, { accessoryModel: { name: "asc" } }],
    }),
  ])

  return {
    counts: {
      devices: models.filter((item) => item.type === "PHONE" && item.isActive).length,
      accessories: models.filter((item) => item.type === "ACCESSORY" && item.isActive).length,
      capacities: capacities.filter((item) => item.isActive).length,
      measures: measures.filter((item) => item.isActive).length,
      colors: colors.filter((item) => item.isActive).length,
    },
    baseCounts: BASE_LOAD_COUNTS,
    models,
    capacities,
    measures,
    colors,
    compatibilities,
  }
}

export async function createCatalogItem(params: {
  tenantId: string
  actorUserId: string
  actorRole: UserRole
  input: Record<string, unknown>
}) {
  const category = assertCatalogCategory(params.input.category)

  return prisma.$transaction(async (tx) => {
    let created: unknown

    if (category === "models") {
      const type = assertCatalogProductType(params.input.type)
      const name = String(params.input.name ?? "").trim()
      if (!name) throw new Error("El modelo es obligatorio.")
      created = await tx.productCatalogModel.upsert({
        where: {
          tenantId_type_normalizedName: {
            tenantId: params.tenantId,
            type,
            normalizedName: normalizeCatalogValue(name),
          },
        },
        update: { name, isActive: true },
        create: {
          tenantId: params.tenantId,
          type,
          name,
          normalizedName: normalizeCatalogValue(name),
          source: "CUSTOM",
          sortOrder: Number(params.input.sortOrder ?? 0),
        },
      })
    } else if (category === "capacities") {
      const capacityGB = Number(params.input.capacityGB)
      if (!Number.isInteger(capacityGB) || capacityGB < 0) throw new Error("Capacidad invalida.")
      const label = String(params.input.label ?? `${capacityGB} GB`).trim()
      created = await tx.productCatalogCapacity.upsert({
        where: { tenantId_capacityGB: { tenantId: params.tenantId, capacityGB } },
        update: { label, isActive: true },
        create: { tenantId: params.tenantId, capacityGB, label, source: "CUSTOM" },
      })
    } else if (category === "measures") {
      const millimeters = new Prisma.Decimal(params.input.millimeters as string | number)
      if (millimeters.lessThan(0)) throw new Error("Medida invalida.")
      const label = String(params.input.label ?? `${millimeters.toString()} mm`).trim()
      created = await tx.productCatalogMeasure.upsert({
        where: { tenantId_millimeters: { tenantId: params.tenantId, millimeters } },
        update: { label, isActive: true },
        create: { tenantId: params.tenantId, millimeters, label, source: "CUSTOM" },
      })
    } else {
      const name = String(params.input.name ?? "").trim()
      const hexColor = String(params.input.hexColor ?? "").trim()
      if (!name) throw new Error("El color es obligatorio.")
      assertHexColor(hexColor)
      created = await tx.productCatalogColor.upsert({
        where: { tenantId_normalizedName: { tenantId: params.tenantId, normalizedName: normalizeCatalogValue(name) } },
        update: { name, hexColor, isActive: true },
        create: {
          tenantId: params.tenantId,
          name,
          normalizedName: normalizeCatalogValue(name),
          hexColor,
          source: "CUSTOM",
        },
      })
    }

    const entity = created as { id?: string }
    await createAuditLog({
      tenantId: params.tenantId,
      actorUserId: params.actorUserId,
      actorRole: params.actorRole,
      action: "CREATE",
      module: "CATALOG",
      entityType: category,
      entityId: entity.id ?? null,
      detail: `Alta de catalogo: ${category}`,
      newValue: created as Prisma.InputJsonValue,
    }, tx)

    return created
  })
}

export async function updateCatalogItem(params: {
  tenantId: string
  actorUserId: string
  actorRole: UserRole
  id: string
  input: Record<string, unknown>
}) {
  const category = assertCatalogCategory(params.input.category)

  return prisma.$transaction(async (tx) => {
    let oldValue: unknown
    let updated: unknown

    if (category === "models") {
      const current = await tx.productCatalogModel.findFirst({ where: { id: params.id, tenantId: params.tenantId } })
      if (!current) throw new Error("Catalogo no encontrado.")
      oldValue = current
      const name = params.input.name === undefined ? current.name : String(params.input.name ?? "").trim()
      if (!name) throw new Error("El modelo es obligatorio.")
      updated = await tx.productCatalogModel.update({
        where: { id: current.id },
        data: {
          name,
          normalizedName: normalizeCatalogValue(name),
          isActive: params.input.isActive === undefined ? current.isActive : Boolean(params.input.isActive),
          sortOrder: params.input.sortOrder === undefined ? current.sortOrder : Number(params.input.sortOrder),
        },
      })
    } else if (category === "capacities") {
      const current = await tx.productCatalogCapacity.findFirst({ where: { id: params.id, tenantId: params.tenantId } })
      if (!current) throw new Error("Catalogo no encontrado.")
      oldValue = current
      updated = await tx.productCatalogCapacity.update({
        where: { id: current.id },
        data: {
          label: params.input.label === undefined ? current.label : String(params.input.label ?? "").trim(),
          isActive: params.input.isActive === undefined ? current.isActive : Boolean(params.input.isActive),
          sortOrder: params.input.sortOrder === undefined ? current.sortOrder : Number(params.input.sortOrder),
        },
      })
    } else if (category === "measures") {
      const current = await tx.productCatalogMeasure.findFirst({ where: { id: params.id, tenantId: params.tenantId } })
      if (!current) throw new Error("Catalogo no encontrado.")
      oldValue = current
      updated = await tx.productCatalogMeasure.update({
        where: { id: current.id },
        data: {
          label: params.input.label === undefined ? current.label : String(params.input.label ?? "").trim(),
          millimeters: params.input.millimeters === undefined ? current.millimeters : new Prisma.Decimal(params.input.millimeters as string | number),
          isActive: params.input.isActive === undefined ? current.isActive : Boolean(params.input.isActive),
          sortOrder: params.input.sortOrder === undefined ? current.sortOrder : Number(params.input.sortOrder),
        },
      })
    } else {
      const current = await tx.productCatalogColor.findFirst({ where: { id: params.id, tenantId: params.tenantId } })
      if (!current) throw new Error("Catalogo no encontrado.")
      oldValue = current
      const name = params.input.name === undefined ? current.name : String(params.input.name ?? "").trim()
      const hexColor = params.input.hexColor === undefined ? current.hexColor : String(params.input.hexColor ?? "").trim()
      assertHexColor(hexColor)
      updated = await tx.productCatalogColor.update({
        where: { id: current.id },
        data: {
          name,
          normalizedName: normalizeCatalogValue(name),
          hexColor,
          isActive: params.input.isActive === undefined ? current.isActive : Boolean(params.input.isActive),
          sortOrder: params.input.sortOrder === undefined ? current.sortOrder : Number(params.input.sortOrder),
        },
      })
    }

    const entity = updated as { id?: string }
    await createAuditLog({
      tenantId: params.tenantId,
      actorUserId: params.actorUserId,
      actorRole: params.actorRole,
      action: "UPDATE",
      module: "CATALOG",
      entityType: category,
      entityId: entity.id ?? params.id,
      detail: `Actualizacion de catalogo: ${category}`,
      oldValue: oldValue as Prisma.InputJsonValue,
      newValue: updated as Prisma.InputJsonValue,
    }, tx)

    return updated
  })
}

export async function softDeleteCatalogItem(params: {
  tenantId: string
  actorUserId: string
  actorRole: UserRole
  id: string
  category: CatalogCategory
}) {
  return updateCatalogItem({
    tenantId: params.tenantId,
    actorUserId: params.actorUserId,
    actorRole: params.actorRole,
    id: params.id,
    input: { category: params.category, isActive: false },
  })
}

type DedupeGroupItem = {
  id: string
  source?: string
  isActive?: boolean
  sortOrder?: number
  createdAt?: Date
  _count?: { products?: number }
}

function pickCanonical<T extends DedupeGroupItem>(items: T[]) {
  return items
    .slice()
    .sort((a, b) => {
      const active = Number(Boolean(b.isActive)) - Number(Boolean(a.isActive))
      if (active !== 0) return active
      const products = (b._count?.products ?? 0) - (a._count?.products ?? 0)
      if (products !== 0) return products
      const sourceScore = (b.source === "BASE" ? 1 : 0) - (a.source === "BASE" ? 1 : 0)
      if (sourceScore !== 0) return sourceScore
      return (a.sortOrder ?? 0) - (b.sortOrder ?? 0)
    })[0]
}

function groupByKey<T>(items: T[], getKey: (item: T) => string) {
  const groups = new Map<string, T[]>()
  for (const item of items) {
    const key = getKey(item)
    groups.set(key, [...(groups.get(key) ?? []), item])
  }
  return Array.from(groups.values()).filter((group) => group.length > 1)
}

async function moveModelCompatibilities(params: {
  tx: Prisma.TransactionClient
  tenantId: string
  fromId: string
  toId: string
  type: ProductType
}) {
  const where =
    params.type === "PHONE"
      ? { tenantId: params.tenantId, phoneModelId: params.fromId }
      : { tenantId: params.tenantId, accessoryModelId: params.fromId }
  const rows = await params.tx.productModelCompatibility.findMany({
    where,
    select: { id: true, phoneModelId: true, accessoryModelId: true, isActive: true },
  })

  for (const row of rows) {
    const nextPhoneModelId = params.type === "PHONE" ? params.toId : row.phoneModelId
    const nextAccessoryModelId = params.type === "ACCESSORY" ? params.toId : row.accessoryModelId
    const existing = await params.tx.productModelCompatibility.findUnique({
      where: {
        tenantId_phoneModelId_accessoryModelId: {
          tenantId: params.tenantId,
          phoneModelId: nextPhoneModelId,
          accessoryModelId: nextAccessoryModelId,
        },
      },
      select: { id: true, isActive: true },
    })

    if (existing) {
      if (!existing.isActive && row.isActive) {
        await params.tx.productModelCompatibility.update({
          where: { id: existing.id },
          data: { isActive: true },
        })
      }
      await params.tx.productModelCompatibility.delete({ where: { id: row.id } })
    } else {
      await params.tx.productModelCompatibility.update({
        where: { id: row.id },
        data:
          params.type === "PHONE"
            ? { phoneModelId: params.toId }
            : { accessoryModelId: params.toId },
      })
    }
  }
}

export async function dedupeCatalog(params: {
  tenantId: string
  actorUserId: string
  actorRole: UserRole
  category: CatalogCategory
  type?: ProductType
}) {
  return prisma.$transaction(async (tx) => {
    let removed = 0
    const canonicalIds: string[] = []

    if (params.category === "models") {
      if (!params.type) throw new Error("Tipo de modelo requerido para limpiar duplicados.")
      const rows = await tx.productCatalogModel.findMany({
        where: { tenantId: params.tenantId, type: params.type },
        include: { _count: { select: { products: true } } },
      })
      for (const group of groupByKey(rows, (item) => item.normalizedName)) {
        const keep = pickCanonical(group)
        if (!keep) continue
        canonicalIds.push(keep.id)
        const duplicates = group.filter((item) => item.id !== keep.id)
        for (const duplicate of duplicates) {
          await tx.product.updateMany({
            where: { tenantId: params.tenantId, catalogModelId: duplicate.id },
            data: { catalogModelId: keep.id, modelName: keep.name },
          })
          await moveModelCompatibilities({
            tx,
            tenantId: params.tenantId,
            fromId: duplicate.id,
            toId: keep.id,
            type: params.type,
          })
          await tx.productCatalogModel.delete({ where: { id: duplicate.id } })
          removed += 1
        }
      }
    } else if (params.category === "capacities") {
      const rows = await tx.productCatalogCapacity.findMany({
        where: { tenantId: params.tenantId },
        include: { _count: { select: { products: true } } },
      })
      for (const group of groupByKey(rows, (item) => String(item.capacityGB))) {
        const keep = pickCanonical(group)
        if (!keep) continue
        canonicalIds.push(keep.id)
        const duplicates = group.filter((item) => item.id !== keep.id)
        for (const duplicate of duplicates) {
          await tx.product.updateMany({
            where: { tenantId: params.tenantId, catalogCapacityId: duplicate.id },
            data: { catalogCapacityId: keep.id, capacityGB: keep.capacityGB },
          })
          await tx.productCatalogCapacity.delete({ where: { id: duplicate.id } })
          removed += 1
        }
      }
    } else if (params.category === "measures") {
      const rows = await tx.productCatalogMeasure.findMany({ where: { tenantId: params.tenantId } })
      for (const group of groupByKey(rows, (item) => String(item.millimeters))) {
        const keep = pickCanonical(group)
        if (!keep) continue
        canonicalIds.push(keep.id)
        const duplicates = group.filter((item) => item.id !== keep.id)
        for (const duplicate of duplicates) {
          await tx.productCatalogMeasure.delete({ where: { id: duplicate.id } })
          removed += 1
        }
      }
    } else {
      const rows = await tx.productCatalogColor.findMany({
        where: { tenantId: params.tenantId },
        include: { _count: { select: { products: true } } },
      })
      for (const group of groupByKey(rows, (item) => item.normalizedName)) {
        const keep = pickCanonical(group)
        if (!keep) continue
        canonicalIds.push(keep.id)
        const duplicates = group.filter((item) => item.id !== keep.id)
        for (const duplicate of duplicates) {
          await tx.product.updateMany({
            where: { tenantId: params.tenantId, catalogColorId: duplicate.id },
            data: { catalogColorId: keep.id, color: keep.name },
          })
          await tx.productCatalogColorAlias.updateMany({
            where: { tenantId: params.tenantId, colorId: duplicate.id },
            data: { colorId: keep.id },
          })
          await tx.productCatalogColor.delete({ where: { id: duplicate.id } })
          removed += 1
        }
      }
    }

    const result = { category: params.category, type: params.type ?? null, removed, canonicalIds }
    await createAuditLog({
      tenantId: params.tenantId,
      actorUserId: params.actorUserId,
      actorRole: params.actorRole,
      action: "DELETE",
      module: "CATALOG",
      entityType: "CatalogDedupe",
      entityId: params.category,
      detail: `Limpieza de duplicados de catalogo: ${params.category}`,
      newValue: result as unknown as Prisma.InputJsonValue,
    }, tx)

    return result
  }, { timeout: 15000, maxWait: 5000 })
}
