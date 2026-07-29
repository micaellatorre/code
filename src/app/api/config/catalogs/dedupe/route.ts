import { NextResponse } from "next/server"
import type { UserRole } from "@prisma/client"
import { requireRoleApi } from "@/lib/auth/auth"
import { getEffectiveAdminTenantId } from "@/lib/config/access"
import { assertCatalogCategory, assertCatalogProductType, dedupeCatalog } from "@/lib/config/catalogService"

export async function POST(request: Request) {
  const auth = await requireRoleApi(["ADMIN"])
  if (!auth.ok) return Response.json({ error: "Unauthorized" }, { status: auth.status })

  try {
    const tenantId = getEffectiveAdminTenantId(auth.session)
    const body = await request.json().catch(() => ({}))
    const category = assertCatalogCategory(body?.category)
    const type = category === "models" ? assertCatalogProductType(body?.type) : undefined
    const result = await dedupeCatalog({
      tenantId,
      category,
      type,
      actorUserId: auth.session.user.id,
      actorRole: auth.session.user.activeRole as UserRole,
    })

    return NextResponse.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo limpiar duplicados"
    return NextResponse.json({ error: message }, { status: message.includes("ADMIN") ? 403 : 400 })
  }
}
