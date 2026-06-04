import prisma from "@/lib/prisma"
import { requireRoleApi } from "@/lib/auth/auth"
import { NextResponse } from "next/server"
import { getTenantId, hasOverlappingBatteryRange, toInteger } from "../_utils"

export async function POST(request: Request) {
  const auth = await requireRoleApi(["ADMIN"])
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: auth.status })

  const tenantId = getTenantId(auth.session)
  if (!tenantId) return NextResponse.json({ error: "DEFAULT_TENANT_ID not set" }, { status: 500 })

  const body = await request.json()
  const label = typeof body.label === "string" ? body.label.trim() : ""
  const minPct = toInteger(body.minPct)
  const maxPct = toInteger(body.maxPct)
  const sortOrder = toInteger(body.sortOrder) ?? 0

  if (!label || minPct === null || maxPct === null || minPct < 0 || maxPct > 100 || minPct > maxPct) {
    return NextResponse.json({ error: "Rango invalido" }, { status: 400 })
  }

  if (await hasOverlappingBatteryRange(tenantId, minPct, maxPct)) {
    return NextResponse.json({ error: "El rango se solapa con otro rango activo" }, { status: 400 })
  }

  const range = await prisma.tradeInBatteryRange.create({
    data: {
      tenantId,
      label,
      minPct,
      maxPct,
      sortOrder,
      isActive: body.isActive !== false,
    },
  })

  return NextResponse.json(range, { status: 201 })
}
