import { NextRequest, NextResponse } from "next/server"
import type { UserRole } from "@prisma/client"
import { requireRoleApi } from "@/lib/auth/auth"
import { getEffectiveAdminTenantId } from "@/lib/config/access"
import { createCatalogItem, getCatalogSnapshot } from "@/lib/config/catalogService"

export async function GET() {
  const auth = await requireRoleApi(["ADMIN"])
  if (!auth.ok) return Response.json({ error: "Unauthorized" }, { status: auth.status })

  try {
    const tenantId = getEffectiveAdminTenantId(auth.session)
    const snapshot = await getCatalogSnapshot(tenantId)
    return NextResponse.json(snapshot)
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo cargar catalogos"
    return NextResponse.json({ error: message }, { status: message.includes("ADMIN") ? 403 : 500 })
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireRoleApi(["ADMIN"])
  if (!auth.ok) return Response.json({ error: "Unauthorized" }, { status: auth.status })

  try {
    const tenantId = getEffectiveAdminTenantId(auth.session)
    const item = await createCatalogItem({
      tenantId,
      actorUserId: auth.session.user.id,
      actorRole: auth.session.user.activeRole as UserRole,
      input: await request.json().catch(() => ({})),
    })
    return NextResponse.json({ item }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo crear catalogo"
    return NextResponse.json({ error: message }, { status: message.includes("ADMIN") ? 403 : 400 })
  }
}
