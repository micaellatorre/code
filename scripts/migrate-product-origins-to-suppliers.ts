import type { UserRole } from "@prisma/client"
import prisma from "@/lib/prisma"
import { getDefaultTenantId } from "@/lib/tenant"
import { createSupplier, findSuppliersByNameInsensitive } from "@/lib/domain/suppliers"

const ORIGIN_NAMES = [
  "BRK",
  "Appletech",
  "Aerotech",
  "Luca Accesorios",
  "Apple Wolf",
  "Alex",
  "Apple Lyon",
  "ig",
  "Virginia vecina Nacho",
  ".",
  "A",
  "Macro Cell",
  "Nadia Berscain",
  "Plan Canje",
  "Priscila Rivarola",
  "aaylen33",
  "alex_pereyra99",
  "bolsa",
  "boolsa",
  "brenda.cangiano",
  "brisaarnaboldi",
  "carlaochoa91",
  "clari",
  "cuadradomatias",
  "desibarbero",
  "emamacrocell",
  "enzootorres",
  "franciscobravx",
  "giulianasanchez_",
  "jennipereir",
  "jiquiroga",
  "juampi.maza",
  "karen_ceballos13",
  "lauheredia",
  "licia071",
  "lucas.q.a",
  "lucero_agus_09",
  "lucianogrosso",
  "macrocell",
  "michelle",
  "nadyatapia",
  "nicolasllambias",
  "niicobenegas",
  "piaa.feernandez",
  "primajuli",
  "soloacristian",
  "tobiasdelgado",
  "verduleria seguros",
] as const

type SupplierRef = { id: string; name: string; branchId: string | null }

type SupplierResult = {
  requestedName: string
  supplierId: string
  supplierName: string
}

type LinkResult = {
  requestedName: string
  supplierId: string
  supplierName: string
  matchingProducts: number
  alreadyLinked: number
  updated: number
  linkedAfter: number
  overwrittenAssociations: number
}

const dryRun = process.argv.includes("--dry-run")

function ensureUniqueOriginList() {
  const seen = new Map<string, string>()
  const duplicates: string[] = []
  for (const name of ORIGIN_NAMES) {
    const key = name.toLowerCase()
    const previous = seen.get(key)
    if (previous) duplicates.push(`${previous} / ${name}`)
    seen.set(key, name)
  }
  return duplicates
}

async function resolveDefaultBranch(tenantId: string) {
  const activeBranch = await prisma.branch.findFirst({
    where: { tenantId, isActive: true },
    orderBy: [{ createdAt: "asc" }, { name: "asc" }],
    select: { id: true, name: true, code: true },
  })
  if (activeBranch) return activeBranch

  return prisma.branch.findFirst({
    where: { tenantId },
    orderBy: [{ createdAt: "asc" }, { name: "asc" }],
    select: { id: true, name: true, code: true },
  })
}

async function resolveActor(tenantId: string) {
  return prisma.user.findFirst({
    where: { tenantId, role: "ADMIN", isActive: true },
    orderBy: [{ createdAt: "asc" }, { email: "asc" }],
    select: { id: true, role: true },
  })
}

async function getSupplierForOrigin(params: {
  tenantId: string
  branchId: string
  actorUserId: string
  actorRole: UserRole
  requestedName: string
  created: SupplierResult[]
  existing: SupplierResult[]
  inconsistencies: string[]
}) {
  const matches = await findSuppliersByNameInsensitive({ tenantId: params.tenantId, name: params.requestedName })

  if (matches.length > 1) {
    params.inconsistencies.push(
      `Hay ${matches.length} proveedores existentes que matchean "${params.requestedName}" case-insensitive: ${matches.map((supplier) => `${supplier.name} (${supplier.id})`).join(", ")}. Se uso el primero por fecha de creacion.`
    )
  }

  const existing = matches[0]
  if (existing) {
    if (existing.name !== params.requestedName) {
      params.inconsistencies.push(
        `El proveedor existente "${existing.name}" matchea case-insensitive con el origen "${params.requestedName}", pero el casing/texto no es identico.`
      )
    }
    params.existing.push({
      requestedName: params.requestedName,
      supplierId: existing.id,
      supplierName: existing.name,
    })
    return existing
  }

  if (dryRun) {
    return null
  }

  const supplier = await createSupplier({
    tenantId: params.tenantId,
    actorUserId: params.actorUserId,
    actorRole: params.actorRole,
    actorRealRole: params.actorRole,
    input: {
      name: params.requestedName,
      branchId: params.branchId,
      branchCoverageIds: [],
      contactName: null,
      phone: null,
      email: null,
      city: null,
      provinceId: null,
      addressStreet: null,
      addressNumber: null,
    },
  })

  const createdSupplier = { id: supplier.id, name: supplier.name, branchId: supplier.branchId } satisfies SupplierRef
  params.created.push({
    requestedName: params.requestedName,
    supplierId: createdSupplier.id,
    supplierName: createdSupplier.name,
  })
  return createdSupplier
}

async function linkProducts(params: {
  tenantId: string
  requestedName: string
  supplier: SupplierRef
}) {
  const products = await prisma.product.findMany({
    where: { tenantId: params.tenantId, origin: params.requestedName },
    select: { id: true, supplierId: true },
  })

  const alreadyLinked = products.filter((product) => product.supplierId === params.supplier.id).length
  const overwrittenAssociations = products.filter((product) => product.supplierId && product.supplierId !== params.supplier.id).length

  let updated = 0
  if (!dryRun) {
    const result = await prisma.product.updateMany({
      where: {
        tenantId: params.tenantId,
        origin: params.requestedName,
        OR: [{ supplierId: null }, { supplierId: { not: params.supplier.id } }],
      },
      data: { supplierId: params.supplier.id },
    })
    updated = result.count
  }

  const linkedAfter = dryRun
    ? alreadyLinked + (products.length - alreadyLinked)
    : await prisma.product.count({
        where: {
          tenantId: params.tenantId,
          origin: params.requestedName,
          supplierId: params.supplier.id,
        },
      })

  return {
    requestedName: params.requestedName,
    supplierId: params.supplier.id,
    supplierName: params.supplier.name,
    matchingProducts: products.length,
    alreadyLinked,
    updated,
    linkedAfter,
    overwrittenAssociations,
  } satisfies LinkResult
}

async function main() {
  const tenantId = await getDefaultTenantId()
  if (!tenantId) throw new Error("DEFAULT_TENANT_ID no esta configurado o no se pudo resolver.")

  const branch = await resolveDefaultBranch(tenantId)
  if (!branch) throw new Error(`No hay sucursal disponible para el tenant ${tenantId}.`)
  if (!branch.id) throw new Error("La sucursal principal no tiene id.")

  const actor = await resolveActor(tenantId)
  if (!actor) throw new Error(`No hay usuario ADMIN activo para auditar la migracion en el tenant ${tenantId}.`)

  const inconsistencies = ensureUniqueOriginList().map((duplicate) => `Origen duplicado en la lista de entrada: ${duplicate}.`)
  const created: SupplierResult[] = []
  const existing: SupplierResult[] = []
  const linked: LinkResult[] = []
  const unableToAssociate: Array<{ origin: string; reason: string; products: number }> = []

  const nonListedOrigins = await prisma.product.groupBy({
    by: ["origin"],
    where: {
      tenantId,
      origin: { not: null, notIn: [...ORIGIN_NAMES] },
    },
    _count: { _all: true },
    orderBy: { origin: "asc" },
  })

  for (const requestedName of ORIGIN_NAMES) {
    const matchingProducts = await prisma.product.count({ where: { tenantId, origin: requestedName } })
    try {
      const supplier = await getSupplierForOrigin({
        tenantId,
        branchId: branch.id,
        actorUserId: actor.id,
        actorRole: actor.role,
        requestedName,
        created,
        existing,
        inconsistencies,
      })

      if (!supplier) {
        unableToAssociate.push({ origin: requestedName, reason: "dry-run: proveedor no creado", products: matchingProducts })
        continue
      }

      linked.push(await linkProducts({ tenantId, requestedName, supplier }))
    } catch (error) {
      unableToAssociate.push({
        origin: requestedName,
        reason: error instanceof Error ? error.message : "Error desconocido",
        products: matchingProducts,
      })
    }
  }

  for (const result of linked) {
    if (result.overwrittenAssociations > 0) {
      inconsistencies.push(
        `${result.overwrittenAssociations} productos con origin "${result.requestedName}" tenian otro supplierId y fueron reasociados a ${result.supplierName}.`
      )
    }
  }

  const summary = {
    mode: dryRun ? "dry-run" : "applied",
    tenantId,
    branch: { id: branch.id, name: branch.name, code: branch.code },
    suppliersCreated: created,
    suppliersAlreadyExisting: existing,
    productsLinkedBySupplier: linked,
    productsUnableToAssociate: unableToAssociate,
    possibleInconsistencies: [
      ...inconsistencies,
      ...nonListedOrigins.map((row) => `Origen no incluido en la lista: "${row.origin}" (${row._count._all} productos).`),
    ],
  }

  console.log(JSON.stringify(summary, null, 2))
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
