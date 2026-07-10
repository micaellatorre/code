import { NextResponse } from "next/server"
import { UserRole } from "@prisma/client"
import { requireRoleApi } from "@/lib/auth/auth"
import { resolveSessionTenantId } from "@/lib/tenant"
import { cashAccountSchema, createCashAccount } from "@/lib/domain/cash"
import { resolveUserBranchContext } from "@/lib/domain/user-branches"
import prisma from "@/lib/prisma"

export async function GET(request: Request) {
  const auth = await requireRoleApi(["ADMIN", "SOCIO", "VENDEDOR", "STOCK"])
  if (!auth.ok) return Response.json({ error: "Unauthorized" }, { status: auth.status })
  const tenantId = await resolveSessionTenantId(auth.session.user.tenantId)
  if (!tenantId) return NextResponse.json({ error: "Tenant no disponible" }, { status: 403 })
  const url = new URL(request.url)
  const all = url.searchParams.get("all") === "1" && auth.session.user.activeRole === "ADMIN"
  const context = await resolveUserBranchContext({
    userId: auth.session.user.id,
    tenantId,
    role: auth.session.user.activeRole,
  })
  const accounts = await prisma.cashAccount.findMany({
    where: all || !context.currentBranch
      ? { tenantId }
      : {
        tenantId,
        isActive: true,
        OR: [
          { scope: "TENANT" },
          { scope: "BRANCH", branchId: context.currentBranch.id },
        ],
      },
    include: { branch: { select: { id: true, name: true, code: true } } },
    orderBy: [{ isActive: "desc" }, { sortOrder: "asc" }, { name: "asc" }],
  })
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
