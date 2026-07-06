import { NextResponse } from "next/server"
import { UserRole } from "@prisma/client"
import prisma from "@/lib/prisma"
import { requireRoleApi } from "@/lib/auth/auth"
import { resolveSessionTenantId } from "@/lib/tenant"
import { commissionSchema, createCommission } from "@/lib/domain/commissions"
import { canSeeDatabaseFinancials } from "@/lib/database/read-models"

export async function GET() {
  const auth = await requireRoleApi(["ADMIN", "SOCIO"])
  if (!auth.ok) return Response.json({ error: "Unauthorized" }, { status: auth.status })
  const tenantId = await resolveSessionTenantId(auth.session.user.tenantId)
  if (!tenantId) return NextResponse.json({ error: "Tenant no disponible" }, { status: 403 })
  const commissions = await prisma.closerCommission.findMany({ where: { tenantId }, orderBy: { earnedAt: "desc" }, include: { closer: true, sale: true, plan: true } })
  const canSee = canSeeDatabaseFinancials(auth.session.user.activeRole)
  return NextResponse.json({ commissions: commissions.map((item) => ({ ...item, baseAmount: canSee ? item.baseAmount : null, amount: canSee ? item.amount : null })) })
}

export async function POST(request: Request) {
  const auth = await requireRoleApi(["ADMIN"])
  if (!auth.ok) return Response.json({ error: "Unauthorized" }, { status: auth.status })
  const tenantId = await resolveSessionTenantId(auth.session.user.tenantId)
  if (!tenantId) return NextResponse.json({ error: "Tenant no disponible" }, { status: 403 })
  const parsed = commissionSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: "Datos invalidos", fieldErrors: parsed.error.flatten().fieldErrors }, { status: 400 })
  try {
    const commission = await createCommission({ tenantId, actorUserId: auth.session.user.id, actorRole: auth.session.user.activeRole as UserRole, input: parsed.data })
    return NextResponse.json({ commission }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error creando comision"
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
