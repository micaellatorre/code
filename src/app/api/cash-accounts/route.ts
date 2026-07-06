import { NextResponse } from "next/server"
import { UserRole } from "@prisma/client"
import prisma from "@/lib/prisma"
import { requireRoleApi } from "@/lib/auth/auth"
import { resolveSessionTenantId } from "@/lib/tenant"
import { cashAccountSchema, createCashAccount } from "@/lib/domain/cash"

export async function GET() {
  const auth = await requireRoleApi(["ADMIN", "SOCIO"])
  if (!auth.ok) return Response.json({ error: "Unauthorized" }, { status: auth.status })
  const tenantId = await resolveSessionTenantId(auth.session.user.tenantId)
  if (!tenantId) return NextResponse.json({ error: "Tenant no disponible" }, { status: 403 })
  const accounts = await prisma.cashAccount.findMany({ where: { tenantId }, orderBy: [{ isActive: "desc" }, { name: "asc" }] })
  return NextResponse.json({ accounts })
}

export async function POST(request: Request) {
  const auth = await requireRoleApi(["ADMIN"])
  if (!auth.ok) return Response.json({ error: "Unauthorized" }, { status: auth.status })
  const tenantId = await resolveSessionTenantId(auth.session.user.tenantId)
  if (!tenantId) return NextResponse.json({ error: "Tenant no disponible" }, { status: 403 })
  const parsed = cashAccountSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: "Datos invalidos", fieldErrors: parsed.error.flatten().fieldErrors }, { status: 400 })
  try {
    const account = await createCashAccount({ tenantId, actorUserId: auth.session.user.id, actorRole: auth.session.user.activeRole as UserRole, input: parsed.data })
    return NextResponse.json({ account }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error creando cuenta"
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
