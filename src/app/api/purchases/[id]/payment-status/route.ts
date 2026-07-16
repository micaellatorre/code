import { NextRequest, NextResponse } from "next/server"
import { UserRole } from "@prisma/client"
import { requireRoleApi } from "@/lib/auth/auth"
import { resolveSessionTenantId } from "@/lib/tenant"
import { purchasePaymentStatusUpdateSchema, updatePurchasePaymentStatus } from "@/lib/domain/purchases"

type Ctx = { params: Promise<{ id: string }> }

export async function PATCH(request: NextRequest, { params }: Ctx) {
  const auth = await requireRoleApi(["ADMIN"])
  if (!auth.ok) return Response.json({ error: "Unauthorized" }, { status: auth.status })

  const tenantId = await resolveSessionTenantId(auth.session.user.tenantId)
  if (!tenantId) return NextResponse.json({ error: "Tenant no disponible" }, { status: 403 })

  const body = await request.json().catch(() => null)
  const parsed = purchasePaymentStatusUpdateSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: "Datos invalidos", fieldErrors: parsed.error.flatten().fieldErrors }, { status: 400 })

  const { id } = await params
  try {
    const purchase = await updatePurchasePaymentStatus({
      tenantId,
      purchaseId: id,
      input: parsed.data,
      actorUserId: auth.session.user.id,
      actorRole: auth.session.user.activeRole as UserRole,
      actorRealRole: auth.session.user.role as UserRole,
    })
    return NextResponse.json({ purchase })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error actualizando estado de pago"
    return NextResponse.json({ error: message }, { status: message.includes("no encontrada") ? 404 : 400 })
  }
}
