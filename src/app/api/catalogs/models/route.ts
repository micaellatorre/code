import { NextRequest, NextResponse } from "next/server"
import { requireRoleApi } from "@/lib/auth/auth"
import { resolveSessionTenantId } from "@/lib/tenant"
import { assertCatalogProductType, searchCatalogModels } from "@/lib/config/catalogService"

export async function GET(request: NextRequest) {
  const auth = await requireRoleApi(["ADMIN", "VENDEDOR", "STOCK", "SOCIO"])
  if (!auth.ok) return Response.json({ error: "Unauthorized" }, { status: auth.status })

  const tenantId = await resolveSessionTenantId(auth.session.user.tenantId)
  if (!tenantId) return NextResponse.json({ error: "Tenant no disponible" }, { status: 403 })

  try {
    const params = request.nextUrl.searchParams
    const type = assertCatalogProductType(params.get("type"))
    const items = await searchCatalogModels({
      tenantId,
      type,
      q: params.get("q"),
      activeOnly: params.get("active") !== "false",
      limit: Number(params.get("limit") ?? 20),
    })
    return NextResponse.json({ items })
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudieron cargar modelos"
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
