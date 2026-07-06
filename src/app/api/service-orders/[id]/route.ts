import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { requireRoleApi } from "@/lib/auth/auth"
import { resolveSessionTenantId } from "@/lib/tenant"
import { canSeeDatabaseFinancials } from "@/lib/database/read-models"

type Ctx = { params: Promise<{ id: string }> }

export async function GET(_request: NextRequest, { params }: Ctx) {
  const auth = await requireRoleApi(["ADMIN", "SOCIO", "VENDEDOR", "STOCK"])
  if (!auth.ok) return Response.json({ error: "Unauthorized" }, { status: auth.status })
  const tenantId = await resolveSessionTenantId(auth.session.user.tenantId)
  if (!tenantId) return NextResponse.json({ error: "Tenant no disponible" }, { status: 403 })
  const { id } = await params
  const order = await prisma.serviceOrder.findFirst({
    where: { id, tenantId },
    include: { buyer: true, product: true, technician: { select: { name: true, email: true } } },
  })
  if (!order) return NextResponse.json({ error: "Orden no encontrada" }, { status: 404 })
  return NextResponse.json({ order: { ...order, costAmount: canSeeDatabaseFinancials(auth.session.user.activeRole) ? order.costAmount : null } })
}
