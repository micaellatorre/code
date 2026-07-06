import { NextRequest, NextResponse } from "next/server"
import { UserRole } from "@prisma/client"
import prisma from "@/lib/prisma"
import { requireRoleApi } from "@/lib/auth/auth"
import { createAuditLog } from "@/lib/domain/audit"
import {
  isBuyerType,
  normalizeBuyerType,
  normalizeInstagramForStorage,
  normalizeNullableString,
  normalizePostalCode,
  parseOptionalDate,
  serializeBuyer,
  validateBuyerRequiredFields,
} from "@/lib/buyers"
import { normalizeProvinceId } from "@/lib/domain/argentina/provinces"

async function getDefaultTenantId() {
  const tenantId = process.env.DEFAULT_TENANT_ID
  if (!tenantId) return undefined

  const tenant = await prisma.tenant.findFirst({ where: { id: tenantId } })
  return tenant?.id ?? tenantId
}

function buildBuyerData(body: Record<string, unknown>) {
  if (body.type != null && !isBuyerType(body.type)) {
    throw new Error("Tipo de cliente invalido")
  }

  const rawProvinceId = normalizeNullableString(body.provinceId)
  const provinceId = rawProvinceId ? normalizeProvinceId(rawProvinceId) : null
  if (rawProvinceId && !provinceId) throw new Error("Provincia invalida")

  const data = {
    type: normalizeBuyerType(body.type),
    name: normalizeNullableString(body.name),
    surname: normalizeNullableString(body.surname),
    businessName: normalizeNullableString(body.businessName),
    dob: parseOptionalDate(body.dob),
    province: normalizeNullableString(body.province),
    provinceId,
    city: normalizeNullableString(body.city),
    postalCode: normalizePostalCode(body.postalCode),
    registeredBranchId: normalizeNullableString(body.registeredBranchId),
    notes: normalizeNullableString(body.notes),
    phone: normalizeNullableString(body.phone),
    instagram: normalizeInstagramForStorage(body.instagram),
    email: normalizeNullableString(body.email),
    addressStreet: normalizeNullableString(body.addressStreet),
    addressNumber: normalizeNullableString(body.addressNumber),
    cuit: normalizeNullableString(body.cuit),
    dni: normalizeNullableString(body.dni),
  }

  validateBuyerRequiredFields(data)

  return {
    ...data,
    name: data.name!,
    surname: data.surname!,
  }
}

async function assertBuyerReferences(tenantId: string, data: { provinceId?: string | null; registeredBranchId?: string | null }) {
  if (data.provinceId) {
    const province = await prisma.province.findUnique({ where: { id: data.provinceId }, select: { id: true } })
    if (!province) throw new Error("Provincia invalida")
  }

  if (data.registeredBranchId) {
    const branch = await prisma.branch.findFirst({ where: { id: data.registeredBranchId, tenantId }, select: { id: true } })
    if (!branch) throw new Error("Sucursal de registro invalida")
  }
}

export async function GET() {
  const auth = await requireRoleApi(["ADMIN", "VENDEDOR"])

  if (!auth.ok) {
    return Response.json({ error: "Unauthorized" }, { status: auth.status })
  }

  try {
    const tenantId = auth.session.user.tenantId ?? (await getDefaultTenantId())
    // TODO: cuando todos los usuarios tengan tenantId obligatorio, remover el fallback y exigir tenantId.
    const buyers = await prisma.buyer.findMany({
      // where: tenantId ? { tenantId } : undefined,
      orderBy: { createdAt: "desc" },
      take: 200,
      include: { provinceRef: true, registeredBranch: { select: { id: true, code: true, name: true } } },
    })
    return NextResponse.json(buyers.map(serializeBuyer))
  } catch (error) {
    console.error("Failed to fetch buyers:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireRoleApi(["ADMIN", "VENDEDOR"])

  if (!auth.ok) {
    return Response.json({ error: "Unauthorized" }, { status: auth.status })
  }

  try {
    const body = await req.json()
    const tenantId = auth.session.user.tenantId ?? (await getDefaultTenantId())

    if (!tenantId) {
      return NextResponse.json({ error: "Tenant no disponible para crear cliente" }, { status: 403 })
    }

    const data = buildBuyerData(body)
    await assertBuyerReferences(tenantId, data)

    const newBuyer = await prisma.buyer.create({
      data: {
        ...data,
        tenantId,
      },
      include: { provinceRef: true, registeredBranch: { select: { id: true, code: true, name: true } } },
    })
    await createAuditLog({
      tenantId,
      actorUserId: auth.session.user.id,
      actorRole: auth.session.user.activeRole as UserRole,
      action: "CREATE",
      module: "BUYER",
      entityType: "Buyer",
      entityId: newBuyer.id,
      detail: `Cliente creado: ${newBuyer.name}`,
      newValue: newBuyer,
    })

    return NextResponse.json({ buyer: serializeBuyer(newBuyer) }, { status: 201 })
  } catch (error: any) {
    const message = error instanceof Error ? error.message : "Internal server error"
    const status = message.includes("obligatori") || message.includes("invalido") || message.includes("invalida") ? 400 : 500
    if (status === 500) console.error("Failed to create buyer:", error)
    return NextResponse.json({ error: message }, { status })
  }
}
