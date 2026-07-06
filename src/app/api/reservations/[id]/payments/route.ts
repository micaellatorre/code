import { NextRequest, NextResponse } from "next/server"
import { UserRole } from "@prisma/client"
import { requireRoleApi } from "@/lib/auth/auth"
import { resolveSessionTenantId } from "@/lib/tenant"
import { addReservationPayment, reservationPaymentSchema } from "@/lib/domain/reservations"

type Ctx = { params: Promise<{ id: string }> }

export async function POST(request: NextRequest, { params }: Ctx) {
  const auth = await requireRoleApi(["ADMIN", "VENDEDOR"])
  if (!auth.ok) return Response.json({ error: "Unauthorized" }, { status: auth.status })
  const tenantId = await resolveSessionTenantId(auth.session.user.tenantId)
  if (!tenantId) return NextResponse.json({ error: "Tenant no disponible" }, { status: 403 })
  const { id } = await params
  const parsed = reservationPaymentSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: "Datos invalidos", fieldErrors: parsed.error.flatten().fieldErrors }, { status: 400 })

  try {
    const reservation = await addReservationPayment({
      tenantId,
      reservationId: id,
      actorUserId: auth.session.user.id,
      actorRole: auth.session.user.activeRole as UserRole,
      input: parsed.data,
    })
    return NextResponse.json({ reservation })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error registrando pago"
    return NextResponse.json({ error: message }, { status: message.includes("no encontrada") ? 404 : 400 })
  }
}
