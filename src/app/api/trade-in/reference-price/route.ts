import prisma from "@/lib/prisma"
import { requireRoleApi } from "@/lib/auth/auth"
import { NextResponse } from "next/server"
import { getTenantId, toInteger } from "../_utils"

export async function GET(request: Request) {
  const auth = await requireRoleApi(["ADMIN", "VENDEDOR"])
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: auth.status })

  const tenantId = getTenantId(auth.session)
  if (!tenantId) return NextResponse.json({ error: "DEFAULT_TENANT_ID not set" }, { status: 500 })

  const { searchParams } = new URL(request.url)
  const modelName = searchParams.get("modelName")?.trim() ?? ""
  const capacityGB = toInteger(searchParams.get("capacityGB"))
  const batteryRangeId = searchParams.get("batteryRangeId") ?? ""

  if (!modelName || capacityGB === null || !batteryRangeId) {
    return NextResponse.json({ error: "Parametros invalidos" }, { status: 400 })
  }

  const price = await prisma.tradeInPrice.findUnique({
    where: {
      tenantId_modelName_capacityGB_batteryRangeId: {
        tenantId,
        modelName,
        capacityGB,
        batteryRangeId,
      },
    },
  })

  return NextResponse.json({
    referencePrice: price ? String(price.referencePrice) : null,
  })
}
