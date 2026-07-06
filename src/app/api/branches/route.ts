import { NextResponse } from "next/server"
import { UserRole } from "@prisma/client"
import { requireRoleApi } from "@/lib/auth/auth"
import { resolveSessionTenantId } from "@/lib/tenant"
import { branchSchema, createBranch, listBranches } from "@/lib/domain/branches"

export async function GET() {
  const auth = await requireRoleApi(["ADMIN", "SOCIO", "VENDEDOR", "STOCK"])
  if (!auth.ok) return Response.json({ error: "Unauthorized" }, { status: auth.status })

  const tenantId = await resolveSessionTenantId(auth.session.user.tenantId)
  if (!tenantId) return NextResponse.json({ error: "Tenant no disponible" }, { status: 403 })

  const branches = await listBranches(tenantId)
  return NextResponse.json({ branches })
}

export async function POST(request: Request) {
  const auth = await requireRoleApi(["ADMIN"])
  if (!auth.ok) return Response.json({ error: "Unauthorized" }, { status: auth.status })

  const tenantId = await resolveSessionTenantId(auth.session.user.tenantId)
  if (!tenantId) return NextResponse.json({ error: "Tenant no disponible" }, { status: 403 })

  const parsed = branchSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos invalidos", fieldErrors: parsed.error.flatten().fieldErrors }, { status: 400 })
  }

  try {
    const branch = await createBranch({
      tenantId,
      actorUserId: auth.session.user.id,
      actorRole: auth.session.user.activeRole as UserRole,
      input: parsed.data,
    })
    return NextResponse.json({ branch }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error creando sucursal"
    return NextResponse.json({ error: message }, { status: message.includes("existe") ? 409 : 500 })
  }
}
