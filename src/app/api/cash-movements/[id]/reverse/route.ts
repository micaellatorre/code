import { NextRequest, NextResponse } from "next/server"
import { UserRole } from "@prisma/client"
import { requireRoleApi } from "@/lib/auth/auth"
import { resolveSessionTenantId } from "@/lib/tenant"
import { reverseCashMovement } from "@/lib/domain/cash"

type Ctx = { params: Promise<{ id: string }> }

export async function POST(_request: NextRequest, { params }: Ctx) {
  const auth = await requireRoleApi(["ADMIN"])
  if (!auth.ok) return Response.json({ error: "Unauthorized" }, { status: auth.status })
  const tenantId = await resolveSessionTenantId(auth.session.user.tenantId)
  if (!tenantId) return NextResponse.json({ error: "Tenant no disponible" }, { status: 403 })
  const { id } = await params
  try {
    const movement = await reverseCashMovement({ tenantId, movementId: id, actorUserId: auth.session.user.id, actorRole: auth.session.user.activeRole as UserRole })
    return NextResponse.json({ movement })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error revirtiendo movimiento"
    return NextResponse.json({ error: message }, { status: message.includes("no encontrado") ? 404 : 400 })
  }
}
