import prisma from "@/lib/prisma"
import { requireRoleApi } from "@/lib/auth/auth"
import { NextResponse } from "next/server"
import { ensureTradeInDefaults, getTenantId, serializeTradeInConfig } from "../_utils"

export async function GET() {
  const auth = await requireRoleApi(["ADMIN", "VENDEDOR"])
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: auth.status })

  const tenantId = getTenantId(auth.session)
  if (!tenantId) return NextResponse.json({ error: "DEFAULT_TENANT_ID not set" }, { status: 500 })

  await ensureTradeInDefaults(tenantId)

  const [batteryRanges, deductionRules, prices] = await Promise.all([
    prisma.tradeInBatteryRange.findMany({
      where: { tenantId },
      orderBy: [{ sortOrder: "asc" }, { minPct: "asc" }],
    }),
    prisma.tradeInDeductionRule.findMany({
      where: { tenantId },
      orderBy: [{ category: "asc" }, { sortOrder: "asc" }, { label: "asc" }],
    }),
    prisma.tradeInPrice.findMany({
      where: { tenantId },
      orderBy: [{ modelName: "asc" }, { capacityGB: "asc" }],
    }),
  ])

  return NextResponse.json(serializeTradeInConfig({ batteryRanges, deductionRules, prices }))
}
