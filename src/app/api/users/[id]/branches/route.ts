import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { UserRole } from "@prisma/client"
import { requireRoleApi } from "@/lib/auth/auth"
import { resolveSessionTenantId } from "@/lib/tenant"
import { setUserBranchCoverage } from "@/lib/domain/user-branches"

type Ctx = { params: Promise<{ id: string }> }

const schema = z.object({
  currentBranchId: z.string().nullable(),
  coverageBranchIds: z.array(z.string().min(1)),
})

export async function PATCH(request: NextRequest, { params }: Ctx) {
  const auth = await requireRoleApi(["ADMIN"])
  if (!auth.ok) return Response.json({ error: "Unauthorized" }, { status: auth.status })

  const tenantId = await resolveSessionTenantId(auth.session.user.tenantId)
  if (!tenantId) return NextResponse.json({ error: "Tenant no disponible" }, { status: 403 })

  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: "Payload invalido", fieldErrors: parsed.error.flatten().fieldErrors }, { status: 400 })

  const { id } = await params

  try {
    const result = await setUserBranchCoverage({
      tenantId,
      actorUserId: auth.session.user.id,
      actorRole: auth.session.user.activeRole as UserRole,
      targetUserId: id,
      currentBranchId: parsed.data.currentBranchId,
      coverageBranchIds: parsed.data.coverageBranchIds,
    })

    return NextResponse.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo actualizar cobertura"
    return NextResponse.json({ error: message }, { status: message.includes("no encontrado") ? 404 : 400 })
  }
}
