import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { requireRoleApi } from "@/lib/auth/auth"
import { resolveSessionTenantId } from "@/lib/tenant"

type Ctx = { params: Promise<{ id: string }> }

export async function GET(_request: NextRequest, { params }: Ctx) {
  const auth = await requireRoleApi(["ADMIN", "SOCIO", "VENDEDOR", "STOCK"])
  if (!auth.ok) return Response.json({ error: "Unauthorized" }, { status: auth.status })
  const tenantId = await resolveSessionTenantId(auth.session.user.tenantId)
  if (!tenantId) return NextResponse.json({ error: "Tenant no disponible" }, { status: 403 })
  const { id } = await params
  const reservation = await prisma.reservation.findFirst({
    where: { id, tenantId },
    include: {
      buyer: true,
      user: { select: { name: true, email: true } },
      items: { include: { product: { select: { modelName: true, imei: true, salePrice: true } } } },
      payments: { orderBy: { paidAt: "asc" } },
      convertedSale: { select: { id: true } },
    },
  })
  if (!reservation) return NextResponse.json({ error: "Reserva no encontrada" }, { status: 404 })
  return NextResponse.json({ reservation })
}

export async function PATCH(request: NextRequest, { params }: Ctx) {
  const auth = await requireRoleApi(["ADMIN", "VENDEDOR"])
  if (!auth.ok) return Response.json({ error: "Unauthorized" }, { status: auth.status })
  const tenantId = await resolveSessionTenantId(auth.session.user.tenantId)
  if (!tenantId) return NextResponse.json({ error: "Tenant no disponible" }, { status: 403 })
  const { id } = await params
  const body = await request.json().catch(() => ({}))

  const reservation = await prisma.reservation.findFirst({ where: { id, tenantId }, select: { id: true, status: true } })
  if (!reservation) return NextResponse.json({ error: "Reserva no encontrada" }, { status: 404 })
  if (reservation.status !== "ACTIVE") return NextResponse.json({ error: "Solo se pueden editar reservas activas" }, { status: 400 })

  const updated = await prisma.reservation.update({
    where: { id },
    data: {
      pickupAt: body.pickupAt ? new Date(body.pickupAt) : undefined,
      agreedTotal: body.agreedTotal === "" || body.agreedTotal == null ? undefined : String(body.agreedTotal),
      notes: typeof body.notes === "string" ? body.notes : undefined,
    },
  })
  return NextResponse.json({ reservation: updated })
}
