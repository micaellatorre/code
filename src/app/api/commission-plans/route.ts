import { NextResponse } from "next/server"
import { UserRole } from "@prisma/client"
import prisma from "@/lib/prisma"
import { requireRoleApi } from "@/lib/auth/auth"
import { resolveSessionTenantId } from "@/lib/tenant"
import { commissionPlanSchema, createCommissionPlan } from "@/lib/domain/commissions"

export async function GET() {
  const auth = await requireRoleApi(["ADMIN", "SOCIO"])
  if (!auth.ok) return Response.json({ error: "Unauthorized" }, { status: auth.status })
  const tenantId = await resolveSessionTenantId(auth.session.user.tenantId)
  if (!tenantId) return NextResponse.json({ error: "Tenant no disponible" }, { status: 403 })
  const plans = await prisma.closerCommissionPlan.findMany({ where: { tenantId }, orderBy: { createdAt: "desc" } })
  return NextResponse.json({ plans })
}

export async function POST(request: Request) {
  const auth = await requireRoleApi(["ADMIN"])
  if (!auth.ok) return Response.json({ error: "Unauthorized" }, { status: auth.status })
  const tenantId = await resolveSessionTenantId(auth.session.user.tenantId)
  if (!tenantId) return NextResponse.json({ error: "Tenant no disponible" }, { status: 403 })
  const parsed = commissionPlanSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: "Datos invalidos", fieldErrors: parsed.error.flatten().fieldErrors }, { status: 400 })
  const plan = await createCommissionPlan({ tenantId, actorUserId: auth.session.user.id, actorRole: auth.session.user.activeRole as UserRole, input: parsed.data })
  return NextResponse.json({ plan }, { status: 201 })
}
