import { NextResponse } from "next/server"
import { UserRole } from "@prisma/client"
import { requireRoleApi } from "@/lib/auth/auth"
import { resolveSessionTenantId } from "@/lib/tenant"
import { cashTransferSchema, createCashTransfer } from "@/lib/domain/cash"

export async function POST(request: Request) {
  const auth = await requireRoleApi(["ADMIN"])
  if (!auth.ok) return Response.json({ error: "Unauthorized" }, { status: auth.status })
  const tenantId = await resolveSessionTenantId(auth.session.user.tenantId)
  if (!tenantId) return NextResponse.json({ error: "Tenant no disponible" }, { status: 403 })
  const parsed = cashTransferSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: "Datos invalidos", fieldErrors: parsed.error.flatten().fieldErrors }, { status: 400 })
  try {
    const transfer = await createCashTransfer({ tenantId, actorUserId: auth.session.user.id, actorRole: auth.session.user.activeRole as UserRole, input: parsed.data })
    return NextResponse.json({ transfer }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error creando transferencia"
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
