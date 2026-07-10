import { NextResponse } from "next/server"
import { UserRole } from "@prisma/client"
import { requireRoleApi } from "@/lib/auth/auth"
import { getFxConversionReport } from "@/lib/domain/cash"
import { resolveSessionTenantId } from "@/lib/tenant"

export async function GET(request: Request) {
  const auth = await requireRoleApi(["ADMIN", "SOCIO"])
  if (!auth.ok) return Response.json({ error: "Unauthorized" }, { status: auth.status })
  const tenantId = await resolveSessionTenantId(auth.session.user.tenantId)
  if (!tenantId) return NextResponse.json({ error: "Tenant no disponible" }, { status: 403 })
  const url = new URL(request.url)
  try {
    const payload = await getFxConversionReport({
      tenantId,
      actorUserId: auth.session.user.id,
      actorRole: auth.session.user.activeRole as UserRole,
      from: url.searchParams.get("from"),
      to: url.searchParams.get("to"),
    })
    return NextResponse.json(payload)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error generando informe cambiario"
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
