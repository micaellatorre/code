import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { requireRoleApi } from "@/lib/auth/auth"
import {
  isBuyerType,
  normalizeInstagramForStorage,
  normalizeNullableString,
  parseOptionalDate,
  serializeBuyer,
  validateBuyerRequiredFields,
} from "@/lib/buyers"

type Ctx = { params: Promise<{ id: string }> }

const TENANT_MISMATCH_MESSAGE = "No podes acceder a este cliente porque pertenece a otro tenant."

const PATCH_FIELDS = [
  "type",
  "name",
  "surname",
  "businessName",
  "dob",
  "province",
  "city",
  "postalCode",
  "notes",
  "phone",
  "instagram",
  "email",
  "addressStreet",
  "addressNumber",
  "cuit",
  "dni",
] as const

function getSessionTenantId(auth: Awaited<ReturnType<typeof requireRoleApi>>) {
  if (!auth.ok) return undefined
  // TODO: cuando todos los usuarios tengan tenantId obligatorio, exigir tenantId tambien en detalle/edicion.
  return auth.session.user.tenantId ?? undefined
}

async function tenantMismatchResponse(id: string, tenantId: string | undefined) {
  if (!tenantId) return null

  const buyer = await prisma.buyer.findUnique({
    where: { id },
    select: { tenantId: true },
  })

  if (!buyer || buyer.tenantId === tenantId) return null

  return NextResponse.json(
    { error: TENANT_MISMATCH_MESSAGE, code: "BUYER_TENANT_MISMATCH" },
    { status: 403 },
  )
}

function buildPatchData(body: Record<string, unknown>) {
  const data: Record<string, unknown> = {}

  for (const field of PATCH_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(body, field)) continue

    if (field === "type") {
      if (!isBuyerType(body.type)) throw new Error("Tipo de cliente invalido")
      data.type = body.type
      continue
    }

    if (field === "name") {
      const name = normalizeNullableString(body.name)
      data.name = name
      continue
    }

    if (field === "dob") {
      data.dob = parseOptionalDate(body.dob)
      continue
    }

    if (field === "instagram") {
      data.instagram = normalizeInstagramForStorage(body.instagram)
      continue
    }

    data[field] = normalizeNullableString(body[field])
  }

  return data
}

export async function GET(_req: NextRequest, { params }: Ctx) {
  const auth = await requireRoleApi(["ADMIN", "VENDEDOR"])

  if (!auth.ok) {
    return Response.json({ error: "Unauthorized" }, { status: auth.status })
  }

  const { id } = await params

  try {
    const tenantId = getSessionTenantId(auth)
    const buyer = await prisma.buyer.findFirst({
      where: { id, ...(tenantId ? { tenantId } : {}) },
    })

    if (!buyer) {
      const mismatch = await tenantMismatchResponse(id, tenantId)
      if (mismatch) return mismatch

      return NextResponse.json({ error: "Buyer not found" }, { status: 404 })
    }

    return NextResponse.json({ buyer: serializeBuyer(buyer) })
  } catch (error) {
    console.error("Failed to get buyer:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const auth = await requireRoleApi(["ADMIN", "VENDEDOR"])

  if (!auth.ok) {
    return Response.json({ error: "Unauthorized" }, { status: auth.status })
  }

  const { id } = await params

  try {
    const body = await req.json()
    const data = buildPatchData(body)

    if (!Object.keys(data).length) {
      return NextResponse.json({ error: "No hay campos para actualizar" }, { status: 400 })
    }

    const tenantId = getSessionTenantId(auth)
    const existingBuyer = await prisma.buyer.findFirst({
      where: { id, ...(tenantId ? { tenantId } : {}) },
    })

    if (!existingBuyer) {
      const mismatch = await tenantMismatchResponse(id, tenantId)
      if (mismatch) return mismatch

      return NextResponse.json({ error: "Buyer not found" }, { status: 404 })
    }

    validateBuyerRequiredFields({
      type: (data.type as any) ?? existingBuyer.type,
      name: Object.prototype.hasOwnProperty.call(data, "name") ? (data.name as string | null) : existingBuyer.name,
      surname: Object.prototype.hasOwnProperty.call(data, "surname") ? (data.surname as string | null) : existingBuyer.surname,
      businessName: Object.prototype.hasOwnProperty.call(data, "businessName") ? (data.businessName as string | null) : existingBuyer.businessName,
      cuit: Object.prototype.hasOwnProperty.call(data, "cuit") ? (data.cuit as string | null) : existingBuyer.cuit,
      dni: Object.prototype.hasOwnProperty.call(data, "dni") ? (data.dni as string | null) : existingBuyer.dni,
    })

    const updatedBuyer = await prisma.buyer.update({
      where: { id },
      data,
    })

    return NextResponse.json({ buyer: serializeBuyer(updatedBuyer) })
  } catch (error: any) {
    const message = error instanceof Error ? error.message : "Internal server error"
    const status = message.includes("obligatori") || message.includes("invalido") || message.includes("invalida") ? 400 : 500
    if (status === 500) console.error("Failed to update buyer:", error)
    return NextResponse.json({ error: message }, { status })
  }
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const auth = await requireRoleApi(["ADMIN", "VENDEDOR"])

  if (!auth.ok) {
    return Response.json({ error: "Unauthorized" }, { status: auth.status })
  }

  const { id } = await params

  try {
    const tenantId = getSessionTenantId(auth)
    const existingBuyer = await prisma.buyer.findFirst({
      where: { id, ...(tenantId ? { tenantId } : {}) },
      select: { id: true },
    })

    if (!existingBuyer) {
      const mismatch = await tenantMismatchResponse(id, tenantId)
      if (mismatch) return mismatch

      return NextResponse.json({ error: "Buyer not found" }, { status: 404 })
    }

    await prisma.buyer.delete({ where: { id } })
    return NextResponse.json({ message: "Buyer deleted successfully" })
  } catch (error) {
    console.error("Failed to delete buyer:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
