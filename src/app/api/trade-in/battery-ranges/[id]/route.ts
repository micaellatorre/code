import prisma from "@/lib/prisma"
import { requireRoleApi } from "@/lib/auth/auth"
import { NextResponse } from "next/server"
import { getTenantId, hasOverlappingBatteryRange, toInteger } from "../../_utils"

type Params = {
  params: Promise<{ id: string }>
}

export async function PATCH(request: Request, { params }: Params) {
  const auth = await requireRoleApi(["ADMIN"])
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: auth.status })

  const tenantId = getTenantId(auth.session)
  if (!tenantId) return NextResponse.json({ error: "DEFAULT_TENANT_ID not set" }, { status: 500 })

  const { id } = await params
  const current = await prisma.tradeInBatteryRange.findFirst({ where: { id, tenantId } })
  if (!current) return NextResponse.json({ error: "Rango no encontrado" }, { status: 404 })

  const body = await request.json()
  const minPct = body.minPct === undefined ? current.minPct : toInteger(body.minPct)
  const maxPct = body.maxPct === undefined ? current.maxPct : toInteger(body.maxPct)
  const sortOrder = body.sortOrder === undefined ? current.sortOrder : toInteger(body.sortOrder)
  const isActive = body.isActive === undefined ? current.isActive : Boolean(body.isActive)
  const label = body.label === undefined ? current.label : String(body.label).trim()

  if (!label || minPct === null || maxPct === null || sortOrder === null || minPct < 0 || maxPct > 100 || minPct > maxPct) {
    return NextResponse.json({ error: "Rango invalido" }, { status: 400 })
  }

  if (isActive && (await hasOverlappingBatteryRange(tenantId, minPct, maxPct, id))) {
    return NextResponse.json({ error: "El rango se solapa con otro rango activo" }, { status: 400 })
  }

  if (!isActive) {
    const activeCount = await prisma.tradeInBatteryRange.count({ where: { tenantId, isActive: true, id: { not: id } } })
    if (activeCount < 1) {
      return NextResponse.json({ error: "Debe quedar al menos un rango activo" }, { status: 400 })
    }
  }

  const range = await prisma.tradeInBatteryRange.update({
    where: { id },
    data: { label, minPct, maxPct, sortOrder, isActive },
  })

  return NextResponse.json(range)
}

export async function DELETE(_request: Request, { params }: Params) {
  const auth = await requireRoleApi(["ADMIN"])
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: auth.status })

  const tenantId = getTenantId(auth.session)
  if (!tenantId) return NextResponse.json({ error: "DEFAULT_TENANT_ID not set" }, { status: 500 })

  const { id } = await params
  const activeCount = await prisma.tradeInBatteryRange.count({ where: { tenantId, isActive: true, id: { not: id } } })
  if (activeCount < 1) {
    return NextResponse.json({ error: "Debe quedar al menos un rango activo" }, { status: 400 })
  }

  const range = await prisma.tradeInBatteryRange.update({
    where: { id },
    data: { isActive: false },
  })

  return NextResponse.json(range)
}
