import { NextResponse } from "next/server"
import { requireAuthApi } from "@/lib/auth/auth"
import { resolveSessionTenantId } from "@/lib/tenant"
import { resolveUserBranchContext } from "@/lib/domain/user-branches"

export async function GET() {
  const auth = await requireAuthApi()
  if (!auth.ok) return Response.json({ error: "Unauthorized" }, { status: auth.status })

  const tenantId = await resolveSessionTenantId(auth.session.user.tenantId)
  if (!tenantId) return NextResponse.json({ error: "Tenant no disponible" }, { status: 403 })

  const context = await resolveUserBranchContext({
    userId: auth.session.user.id,
    tenantId,
    role: auth.session.user.activeRole,
  })

  return NextResponse.json({
    currentBranch: context.currentBranch,
    branches: context.branches,
    error: context.error,
  })
}
