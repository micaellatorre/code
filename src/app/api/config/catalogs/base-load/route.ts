import { NextResponse } from "next/server"
import type { UserRole } from "@prisma/client"
import { requireRoleApi } from "@/lib/auth/auth"
import { getEffectiveAdminTenantId } from "@/lib/config/access"
import { assertBaseLoadCategory, loadBaseCatalog } from "@/lib/config/catalogService"

export async function POST(request: Request) {
  const auth = await requireRoleApi(["ADMIN"])
  if (!auth.ok) return Response.json({ error: "Unauthorized" }, { status: auth.status })

  try {
    const tenantId = getEffectiveAdminTenantId(auth.session)
    const body = await request.json().catch(() => ({}))
    const category = assertBaseLoadCategory(body?.category)
    const result = await loadBaseCatalog({
      tenantId,
      category,
      actorUserId: auth.session.user.id,
      actorRole: auth.session.user.activeRole as UserRole,
    })

    return NextResponse.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo ejecutar carga base"
    return NextResponse.json({ error: message }, { status: message.includes("ADMIN") ? 403 : 400 })
  }
}
