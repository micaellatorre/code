import { NextRequest, NextResponse } from "next/server"
import type { UserRole } from "@prisma/client"
import { requireRoleApi } from "@/lib/auth/auth"
import { getEffectiveAdminTenantId } from "@/lib/config/access"
import { assertCatalogCategory, softDeleteCatalogItem, updateCatalogItem } from "@/lib/config/catalogService"

type Ctx = { params: Promise<{ id: string }> }

export async function PATCH(request: NextRequest, { params }: Ctx) {
  const auth = await requireRoleApi(["ADMIN"])
  if (!auth.ok) return Response.json({ error: "Unauthorized" }, { status: auth.status })

  try {
    const tenantId = getEffectiveAdminTenantId(auth.session)
    const { id } = await params
    const item = await updateCatalogItem({
      tenantId,
      actorUserId: auth.session.user.id,
      actorRole: auth.session.user.activeRole as UserRole,
      id,
      input: await request.json().catch(() => ({})),
    })
    return NextResponse.json({ item })
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo actualizar catalogo"
    return NextResponse.json({ error: message }, { status: message.includes("ADMIN") ? 403 : 400 })
  }
}

export async function DELETE(request: NextRequest, { params }: Ctx) {
  const auth = await requireRoleApi(["ADMIN"])
  if (!auth.ok) return Response.json({ error: "Unauthorized" }, { status: auth.status })

  try {
    const tenantId = getEffectiveAdminTenantId(auth.session)
    const { id } = await params
    const category = assertCatalogCategory(new URL(request.url).searchParams.get("category"))
    const item = await softDeleteCatalogItem({
      tenantId,
      actorUserId: auth.session.user.id,
      actorRole: auth.session.user.activeRole as UserRole,
      id,
      category,
    })
    return NextResponse.json({ item })
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo desactivar catalogo"
    return NextResponse.json({ error: message }, { status: message.includes("ADMIN") ? 403 : 400 })
  }
}
