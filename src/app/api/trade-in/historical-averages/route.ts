import prisma from "@/lib/prisma"
import { requireRoleApi } from "@/lib/auth/auth"
import { NextResponse } from "next/server"
import { getTenantId } from "../_utils"

export type HistoricalAverage = {
  modelName: string
  capacityGB: number
  batteryRangeId: string
  averagePrice: number | null
  sampleSize: number
}

export async function GET() {
  const auth = await requireRoleApi(["ADMIN"])
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: auth.status })

  const tenantId = getTenantId(auth.session)
  if (!tenantId) return NextResponse.json({ error: "DEFAULT_TENANT_ID not set" }, { status: 500 })

  const [ranges, products] = await Promise.all([
    prisma.tradeInBatteryRange.findMany({
      where: { tenantId, isActive: true },
      orderBy: [{ sortOrder: "asc" }, { minPct: "asc" }],
      select: { id: true, minPct: true, maxPct: true },
    }),
    prisma.product.findMany({
      where: {
        tenantId,
        type: "PHONE",
        capacityGB: { not: null },
        batteryPct: { not: null },
        costPrice: { gt: 0 },
      },
      select: {
        modelName: true,
        capacityGB: true,
        batteryPct: true,
        costPrice: true,
      },
    }),
  ])

  const grouped = new Map<string, { total: number; sampleSize: number; modelName: string; capacityGB: number; batteryRangeId: string }>()

  products.forEach((product) => {
    if (product.capacityGB == null || product.batteryPct == null) return
    const range = ranges.find((item) => product.batteryPct! >= item.minPct && product.batteryPct! <= item.maxPct)
    if (!range) return

    const key = `${product.modelName}|${product.capacityGB}|${range.id}`
    const current = grouped.get(key) ?? {
      total: 0,
      sampleSize: 0,
      modelName: product.modelName,
      capacityGB: product.capacityGB,
      batteryRangeId: range.id,
    }
    current.total += Number(product.costPrice)
    current.sampleSize += 1
    grouped.set(key, current)
  })

  const averages: HistoricalAverage[] = Array.from(grouped.values()).map((item) => ({
    modelName: item.modelName,
    capacityGB: item.capacityGB,
    batteryRangeId: item.batteryRangeId,
    averagePrice: Math.round((item.total / item.sampleSize) * 100) / 100,
    sampleSize: item.sampleSize,
  }))

  return NextResponse.json({ averages })
}
