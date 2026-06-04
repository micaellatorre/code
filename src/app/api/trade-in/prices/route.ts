import prisma from "@/lib/prisma"
import { requireRoleApi } from "@/lib/auth/auth"
import { NextResponse } from "next/server"
import { getTenantId, toInteger, toNonNegativeMoney } from "../_utils"

export async function POST(request: Request) {
  const auth = await requireRoleApi(["ADMIN"])
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: auth.status })

  const tenantId = getTenantId(auth.session)
  if (!tenantId) return NextResponse.json({ error: "DEFAULT_TENANT_ID not set" }, { status: 500 })

  const body = await request.json()
  const modelName = typeof body.modelName === "string" ? body.modelName.trim() : ""
  const capacityGB = toInteger(body.capacityGB)
  const batteryRangeId = typeof body.batteryRangeId === "string" ? body.batteryRangeId : ""
  const referencePrice = toNonNegativeMoney(body.referencePrice)

  if (!modelName || capacityGB === null || capacityGB <= 0 || !batteryRangeId || referencePrice === null) {
    return NextResponse.json({ error: "Precio invalido" }, { status: 400 })
  }

  const range = await prisma.tradeInBatteryRange.findFirst({ where: { id: batteryRangeId, tenantId } })
  if (!range) return NextResponse.json({ error: "Rango no encontrado" }, { status: 404 })

  const price = await prisma.tradeInPrice.upsert({
    where: {
      tenantId_modelName_capacityGB_batteryRangeId: {
        tenantId,
        modelName,
        capacityGB,
        batteryRangeId,
      },
    },
    create: {
      tenantId,
      modelName,
      capacityGB,
      batteryRangeId,
      referencePrice,
    },
    update: {
      referencePrice,
    },
  })

  return NextResponse.json({ ...price, referencePrice: String(price.referencePrice) })
}
