import { NextResponse } from "next/server"
import { UserRole } from "@prisma/client"
import prisma from "@/lib/prisma"
import { requireRoleApi } from "@/lib/auth/auth"
import { resolveSessionTenantId } from "@/lib/tenant"
import { createServiceOrder, serviceOrderSchema } from "@/lib/domain/service-orders"
import { canSeeDatabaseFinancials } from "@/lib/database/read-models"

export async function GET() {
  const auth = await requireRoleApi(["ADMIN", "SOCIO", "VENDEDOR", "STOCK"])
  if (!auth.ok) return Response.json({ error: "Unauthorized" }, { status: auth.status })
  const tenantId = await resolveSessionTenantId(auth.session.user.tenantId)
  if (!tenantId) return NextResponse.json({ error: "Tenant no disponible" }, { status: 403 })
  const canSeeCost = canSeeDatabaseFinancials(auth.session.user.activeRole)
  const orders = await prisma.serviceOrder.findMany({
    where: { tenantId },
    orderBy: { receivedAt: "desc" },
    include: { buyer: true, product: true, technician: { select: { name: true, email: true } } },
  })
  return NextResponse.json({ orders: orders.map((order) => ({ ...order, costAmount: canSeeCost ? order.costAmount : null })) })
}

export async function POST(request: Request) {
  const auth = await requireRoleApi(["ADMIN", "VENDEDOR", "STOCK"])
  if (!auth.ok) return Response.json({ error: "Unauthorized" }, { status: auth.status })
  const tenantId = await resolveSessionTenantId(auth.session.user.tenantId)
  if (!tenantId) return NextResponse.json({ error: "Tenant no disponible" }, { status: 403 })
  const parsed = serviceOrderSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: "Datos invalidos", fieldErrors: parsed.error.flatten().fieldErrors }, { status: 400 })

  try {
    const order = await createServiceOrder({
      tenantId,
      actorUserId: auth.session.user.id,
      actorRole: auth.session.user.activeRole as UserRole,
      input: parsed.data,
    })
    return NextResponse.json({ order }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error creando orden"
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
