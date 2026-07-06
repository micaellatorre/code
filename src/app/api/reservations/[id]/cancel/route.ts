import { NextRequest, NextResponse } from "next/server"
import { UserRole } from "@prisma/client"
import { requireRoleApi } from "@/lib/auth/auth"
import { resolveSessionTenantId } from "@/lib/tenant"
import { cancelReservation } from "@/lib/domain/reservations"

type Ctx = { params: Promise<{ id: string }> }

export async function POST(_request: NextRequest, { params }: Ctx) {
  const auth = await requireRoleApi(["ADMIN", "VENDEDOR"])
  if (!auth.ok) return Response.json({ error: "Unauthorized" }, { status: auth.status })
  const tenantId = await resolveSessionTenantId(auth.session.user.tenantId)
  if (!tenantId) return NextResponse.json({ error: "Tenant no disponible" }, { status: 403 })
  const { id } = await params
  try {
    const reservation = await cancelReservation({
      tenantId,
      reservationId: id,
      actorUserId: auth.session.user.id,
      actorRole: auth.session.user.activeRole as UserRole,
    })
    return NextResponse.json({ reservation })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error cancelando reserva"
    return NextResponse.json({ error: message }, { status: message.includes("no encontrada") ? 404 : 400 })
  }
}
