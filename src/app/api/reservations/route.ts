import { NextResponse } from "next/server"
import { UserRole } from "@prisma/client"
import prisma from "@/lib/prisma"
import { requireRoleApi } from "@/lib/auth/auth"
import { resolveSessionTenantId } from "@/lib/tenant"
import { createReservation, reservationSchema } from "@/lib/domain/reservations"

export async function GET() {
  const auth = await requireRoleApi(["ADMIN", "SOCIO", "VENDEDOR", "STOCK"])
  if (!auth.ok) return Response.json({ error: "Unauthorized" }, { status: auth.status })
  const tenantId = await resolveSessionTenantId(auth.session.user.tenantId)
  if (!tenantId) return NextResponse.json({ error: "Tenant no disponible" }, { status: 403 })

  const reservations = await prisma.reservation.findMany({
    where: { tenantId },
    orderBy: { reservedAt: "desc" },
    include: {
      buyer: true,
      user: { select: { name: true, email: true } },
      items: { include: { product: { select: { modelName: true, imei: true } } } },
      payments: { orderBy: { paidAt: "asc" } },
      convertedSale: { select: { id: true } },
    },
  })
  return NextResponse.json({ reservations })
}

export async function POST(request: Request) {
  const auth = await requireRoleApi(["ADMIN", "VENDEDOR"])
  if (!auth.ok) return Response.json({ error: "Unauthorized" }, { status: auth.status })
  const tenantId = await resolveSessionTenantId(auth.session.user.tenantId)
  if (!tenantId) return NextResponse.json({ error: "Tenant no disponible" }, { status: 403 })

  const parsed = reservationSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos invalidos", fieldErrors: parsed.error.flatten().fieldErrors }, { status: 400 })
  }

  try {
    const reservation = await createReservation({
      tenantId,
      actorUserId: auth.session.user.id,
      actorRole: auth.session.user.activeRole as UserRole,
      input: parsed.data,
    })
    return NextResponse.json({ reservation }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error creando reserva"
    return NextResponse.json({ error: message }, { status: message.includes("no disponible") ? 400 : 500 })
  }
}
