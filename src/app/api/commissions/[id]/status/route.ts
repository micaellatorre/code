import { NextRequest, NextResponse } from "next/server"
import { CommissionStatus, UserRole } from "@prisma/client"
import { requireRoleApi } from "@/lib/auth/auth"
import { resolveSessionTenantId } from "@/lib/tenant"
import { updateCommissionStatus } from "@/lib/domain/commissions"

type Ctx = { params: Promise<{ id: string }> }

export async function POST(request: NextRequest, { params }: Ctx) {
  const auth = await requireRoleApi(["ADMIN"])
  if (!auth.ok) return Response.json({ error: "Unauthorized" }, { status: auth.status })
  const tenantId = await resolveSessionTenantId(auth.session.user.tenantId)
  if (!tenantId) return NextResponse.json({ error: "Tenant no disponible" }, { status: 403 })
  const body = await request.json().catch(() => null)
  const status = body?.status as CommissionStatus | undefined
  if (!status || !Object.values(CommissionStatus).includes(status)) return NextResponse.json({ error: "Estado invalido" }, { status: 400 })
  const { id } = await params
  try {
    const commission = await updateCommissionStatus({ tenantId, commissionId: id, status, actorUserId: auth.session.user.id, actorRole: auth.session.user.activeRole as UserRole })
    return NextResponse.json({ commission })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error actualizando comision"
    return NextResponse.json({ error: message }, { status: message.includes("no encontrada") ? 404 : 400 })
  }
}
