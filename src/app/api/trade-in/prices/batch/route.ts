import prisma from "@/lib/prisma"
import { requireRoleApi } from "@/lib/auth/auth"
import { NextResponse } from "next/server"
import { getTenantId, toInteger, toNonNegativeMoney } from "../../_utils"

type NormalizedPrice = {
  modelName: string
  capacityGB: number
  batteryRangeId: string
  referencePrice: NonNullable<ReturnType<typeof toNonNegativeMoney>>
}

export async function POST(request: Request) {
  const auth = await requireRoleApi(["ADMIN"])
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: auth.status })

  const tenantId = getTenantId(auth.session)
  if (!tenantId) return NextResponse.json({ error: "DEFAULT_TENANT_ID not set" }, { status: 500 })

  const body = await request.json()
  const items: unknown[] = Array.isArray(body.items) ? body.items : []
  const normalized: NormalizedPrice[] = []

  for (const item of items) {
    const input = item as {
      modelName?: unknown
      capacityGB?: unknown
      batteryRangeId?: unknown
      referencePrice?: unknown
    }
    const modelName = typeof input.modelName === "string" ? input.modelName.trim() : ""
    const capacityGB = toInteger(input.capacityGB)
    const batteryRangeId = typeof input.batteryRangeId === "string" ? input.batteryRangeId : ""
    const referencePrice = toNonNegativeMoney(input.referencePrice)

    if (!modelName || capacityGB === null || capacityGB <= 0 || !batteryRangeId || referencePrice === null) {
      return NextResponse.json({ error: "Precio invalido" }, { status: 400 })
    }

    normalized.push({ modelName, capacityGB, batteryRangeId, referencePrice })
  }

  if (!normalized.length) return NextResponse.json({ prices: [] })

  const rangeCount = await prisma.tradeInBatteryRange.count({
    where: {
      tenantId,
      id: { in: Array.from(new Set(normalized.map((item) => item.batteryRangeId))) },
    },
  })
  if (rangeCount !== new Set(normalized.map((item) => item.batteryRangeId)).size) {
    return NextResponse.json({ error: "Rango no encontrado" }, { status: 404 })
  }

  const prices = await prisma.$transaction(
    normalized.map((item) =>
      prisma.tradeInPrice.upsert({
        where: {
          tenantId_modelName_capacityGB_batteryRangeId: {
            tenantId,
            modelName: item.modelName,
            capacityGB: item.capacityGB,
            batteryRangeId: item.batteryRangeId,
          },
        },
        create: {
          tenantId,
          modelName: item.modelName,
          capacityGB: item.capacityGB,
          batteryRangeId: item.batteryRangeId,
          referencePrice: item.referencePrice,
        },
        update: {
          referencePrice: item.referencePrice,
        },
      })
    )
  )

  return NextResponse.json({
    prices: prices.map((price) => ({ ...price, referencePrice: String(price.referencePrice) })),
  })
}
