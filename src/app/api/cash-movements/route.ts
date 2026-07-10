import { NextResponse } from "next/server"
import { UserRole } from "@prisma/client"
import { requireRoleApi } from "@/lib/auth/auth"
import { resolveSessionTenantId } from "@/lib/tenant"
import { cashMovementSchema, cashMovementsQuerySchema, createCashMovement, getCashMovements } from "@/lib/domain/cash"

export async function GET(request: Request) {
  const auth = await requireRoleApi(["ADMIN", "SOCIO"])
  if (!auth.ok) return Response.json({ error: "Unauthorized" }, { status: auth.status })
  const tenantId = await resolveSessionTenantId(auth.session.user.tenantId)
  if (!tenantId) return NextResponse.json({ error: "Tenant no disponible" }, { status: 403 })
  const url = new URL(request.url)
  const parsed = cashMovementsQuerySchema.safeParse(Object.fromEntries(url.searchParams.entries()))
  if (!parsed.success) return NextResponse.json({ error: "Filtros invalidos", fieldErrors: parsed.error.flatten().fieldErrors }, { status: 400 })
  try {
    const payload = await getCashMovements({
      tenantId,
      actorUserId: auth.session.user.id,
      actorRole: auth.session.user.activeRole as UserRole,
      query: parsed.data,
    })
    return NextResponse.json(payload)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error listando movimientos"
    return NextResponse.json({ error: message }, { status: 400 })
  }
}

export async function POST(request: Request) {
  const auth = await requireRoleApi(["ADMIN"])
  if (!auth.ok) return Response.json({ error: "Unauthorized" }, { status: auth.status })
  const tenantId = await resolveSessionTenantId(auth.session.user.tenantId)
  if (!tenantId) return NextResponse.json({ error: "Tenant no disponible" }, { status: 403 })
  const parsed = cashMovementSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: "Datos invalidos", fieldErrors: parsed.error.flatten().fieldErrors }, { status: 400 })
  try {
    const movement = await createCashMovement({ tenantId, actorUserId: auth.session.user.id, actorRole: auth.session.user.activeRole as UserRole, input: parsed.data })
    return NextResponse.json({ movement }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error creando movimiento"
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
