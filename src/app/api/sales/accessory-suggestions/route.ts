import { NextRequest, NextResponse } from "next/server"
import { requireRoleApi } from "@/lib/auth/auth"
import { getCompatibleAccessorySuggestions } from "@/lib/config/compatibilityService"

export async function GET(request: NextRequest) {
  const auth = await requireRoleApi(["ADMIN", "VENDEDOR"])
  if (!auth.ok) return Response.json({ error: "Unauthorized" }, { status: auth.status })

  const tenantId = auth.session.user.tenantId
  if (!tenantId) return NextResponse.json({ error: "Tenant no disponible" }, { status: 403 })

  try {
    const searchParams = new URL(request.url).searchParams
    const ids = (searchParams.get("phoneProductIds") ?? searchParams.get("phoneProductId") ?? "")
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean)
      .slice(0, 80)
    const branchId = searchParams.get("branchId")
    const saleType = searchParams.get("saleType") === "MAYORISTA" ? "MAYORISTA" : "MINORISTA"
    const canSeeFinancials = auth.session.user.activeRole === "ADMIN"

    const entries = await Promise.all(
      ids.map(async (phoneProductId) => {
        const suggestions = await getCompatibleAccessorySuggestions({
          tenantId,
          phoneProductId,
          branchId,
          saleType,
          canSeeFinancials,
        }).catch(() => [])
        return [phoneProductId, suggestions] as const
      }),
    )

    return NextResponse.json({ suggestionsByPhoneProductId: Object.fromEntries(entries) })
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudieron cargar sugerencias"
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
