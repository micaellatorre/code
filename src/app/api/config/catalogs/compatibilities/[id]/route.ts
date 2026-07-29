import { NextRequest, NextResponse } from "next/server"
import type { UserRole } from "@prisma/client"
import { requireRoleApi } from "@/lib/auth/auth"
import { getEffectiveAdminTenantId } from "@/lib/config/access"
import { deleteCompatibility, updateCompatibility } from "@/lib/config/compatibilityService"

type Ctx = { params: Promise<{ id: string }> }

export async function PATCH(request: NextRequest, { params }: Ctx) {
  const auth = await requireRoleApi(["ADMIN"])
  if (!auth.ok) return Response.json({ error: "Unauthorized" }, { status: auth.status })

  try {
    const tenantId = getEffectiveAdminTenantId(auth.session)
    const { id } = await params
    const body = await request.json().catch(() => ({}))
    const compatibility = await updateCompatibility({
      tenantId,
      actorUserId: auth.session.user.id,
      actorRole: auth.session.user.activeRole as UserRole,
      id,
      sortOrder: body.sortOrder == null ? undefined : Number(body.sortOrder),
      isActive: body.isActive == null ? undefined : Boolean(body.isActive),
    })
    return NextResponse.json({ compatibility })
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo actualizar compatibilidad"
    return NextResponse.json({ error: message }, { status: message.includes("ADMIN") ? 403 : 400 })
  }
}

export async function DELETE(_request: NextRequest, { params }: Ctx) {
  const auth = await requireRoleApi(["ADMIN"])
  if (!auth.ok) return Response.json({ error: "Unauthorized" }, { status: auth.status })

  try {
    const tenantId = getEffectiveAdminTenantId(auth.session)
    const { id } = await params
    const compatibility = await deleteCompatibility({
      tenantId,
      actorUserId: auth.session.user.id,
      actorRole: auth.session.user.activeRole as UserRole,
      id,
    })
    return NextResponse.json({ compatibility })
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo desactivar compatibilidad"
    return NextResponse.json({ error: message }, { status: message.includes("ADMIN") ? 403 : 400 })
  }
}
