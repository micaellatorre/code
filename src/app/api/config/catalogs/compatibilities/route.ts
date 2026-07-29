import { NextRequest, NextResponse } from "next/server"
import type { UserRole } from "@prisma/client"
import { requireRoleApi } from "@/lib/auth/auth"
import { getEffectiveAdminTenantId } from "@/lib/config/access"
import {
  createCompatibility,
  listCompatibilities,
  replacePhoneCompatibilities,
} from "@/lib/config/compatibilityService"

export async function GET(request: NextRequest) {
  const auth = await requireRoleApi(["ADMIN"])
  if (!auth.ok) return Response.json({ error: "Unauthorized" }, { status: auth.status })

  try {
    const tenantId = getEffectiveAdminTenantId(auth.session)
    const searchParams = new URL(request.url).searchParams
    const active = searchParams.get("active")
    const compatibilities = await listCompatibilities({
      tenantId,
      phoneModelId: searchParams.get("phoneModelId"),
      accessoryModelId: searchParams.get("accessoryModelId"),
      active: active == null ? null : active === "true",
    })
    return NextResponse.json({ compatibilities })
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudieron cargar compatibilidades"
    return NextResponse.json({ error: message }, { status: message.includes("ADMIN") ? 403 : 500 })
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireRoleApi(["ADMIN"])
  if (!auth.ok) return Response.json({ error: "Unauthorized" }, { status: auth.status })

  try {
    const tenantId = getEffectiveAdminTenantId(auth.session)
    const body = await request.json().catch(() => ({}))

    if (Array.isArray(body.accessoryModelIds)) {
      const result = await replacePhoneCompatibilities({
        tenantId,
        actorUserId: auth.session.user.id,
        actorRole: auth.session.user.activeRole as UserRole,
        phoneModelId: String(body.phoneModelId ?? ""),
        accessoryModelIds: body.accessoryModelIds.map((id: unknown) => String(id)),
      })
      return NextResponse.json(result)
    }

    const compatibility = await createCompatibility({
      tenantId,
      actorUserId: auth.session.user.id,
      actorRole: auth.session.user.activeRole as UserRole,
      phoneModelId: String(body.phoneModelId ?? ""),
      accessoryModelId: String(body.accessoryModelId ?? ""),
      sortOrder: body.sortOrder == null ? undefined : Number(body.sortOrder),
    })
    return NextResponse.json({ compatibility }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo guardar compatibilidad"
    return NextResponse.json({ error: message }, { status: message.includes("ADMIN") ? 403 : 400 })
  }
}
