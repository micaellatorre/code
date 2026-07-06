import { NextResponse } from "next/server"
import { z } from "zod"
import { requireAuthApi } from "@/lib/auth/auth"
import { resolveSessionTenantId } from "@/lib/tenant"
import { setCurrentUserBranch } from "@/lib/domain/user-branches"

const schema = z.object({
  branchId: z.string().min(1),
})

export async function PATCH(request: Request) {
  const auth = await requireAuthApi()
  if (!auth.ok) return Response.json({ error: "Unauthorized" }, { status: auth.status })

  const tenantId = await resolveSessionTenantId(auth.session.user.tenantId)
  if (!tenantId) return NextResponse.json({ error: "Tenant no disponible" }, { status: 403 })

  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: "Payload invalido" }, { status: 400 })

  try {
    const currentBranch = await setCurrentUserBranch({
      actorUserId: auth.session.user.id,
      actorRole: auth.session.user.activeRole,
      tenantId,
      branchId: parsed.data.branchId,
    })

    return NextResponse.json({ currentBranch })
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo cambiar la sucursal actual"
    return NextResponse.json({ error: message }, { status: message.includes("no disponible") ? 403 : 400 })
  }
}
