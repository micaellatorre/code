import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { requireRoleApi } from "@/lib/auth/auth"
import {
  isBuyerType,
  normalizeBuyerType,
  normalizeInstagramForStorage,
  normalizeNullableString,
  parseOptionalDate,
  serializeBuyer,
  validateBuyerRequiredFields,
} from "@/lib/buyers"

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

  const data = {
    type: normalizeBuyerType(body.type),
    name: normalizeNullableString(body.name),
    surname: normalizeNullableString(body.surname),
    businessName: normalizeNullableString(body.businessName),
    dob: parseOptionalDate(body.dob),
    province: normalizeNullableString(body.province),
    city: normalizeNullableString(body.city),
    postalCode: normalizeNullableString(body.postalCode),
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

    const newBuyer = await prisma.buyer.create({
      data: {
        ...buildBuyerData(body),
        tenantId,
      },
    })

    return NextResponse.json({ buyer: serializeBuyer(newBuyer) }, { status: 201 })
  } catch (error: any) {
    const message = error instanceof Error ? error.message : "Internal server error"
    const status = message.includes("obligatori") || message.includes("invalido") || message.includes("invalida") ? 400 : 500
    if (status === 500) console.error("Failed to create buyer:", error)
    return NextResponse.json({ error: message }, { status })
  }
}
