import prisma from "@/lib/prisma"
import { requireRoleApi } from "@/lib/auth/auth"
import { NextResponse } from "next/server"
import { getTenantId, toInteger, toNonNegativeMoney } from "../_utils"

const CATEGORIES = ["PANTALLA_MODULO", "TAPA", "CAMARA", "FUNCIONAMIENTO", "OTRO"] as const
const SCOPES = ["GLOBAL", "MODEL", "MODEL_CAPACITY"] as const

function parseScope(body: any) {
  const scope = SCOPES.includes(body.scope) ? body.scope : "GLOBAL"
  const modelName = typeof body.modelName === "string" && body.modelName.trim() ? body.modelName.trim() : null
  const capacityGB = body.capacityGB === null || body.capacityGB === "" || body.capacityGB === undefined ? null : toInteger(body.capacityGB)

  if (scope === "GLOBAL") return { ok: true as const, scope, modelName: null, capacityGB: null }
  if (scope === "MODEL") return modelName ? { ok: true as const, scope, modelName, capacityGB: null } : { ok: false as const }
  if (capacityGB === null) return { ok: false as const }
  return modelName ? { ok: true as const, scope, modelName, capacityGB } : { ok: false as const }
}

export async function POST(request: Request) {
  const auth = await requireRoleApi(["ADMIN"])
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: auth.status })

  const tenantId = getTenantId(auth.session)
  if (!tenantId) return NextResponse.json({ error: "DEFAULT_TENANT_ID not set" }, { status: 500 })

  const body = await request.json()
  const category = String(body.category)
  const label = typeof body.label === "string" ? body.label.trim() : ""
  const amount = toNonNegativeMoney(body.amount)
  const sortOrder = toInteger(body.sortOrder) ?? 0
  const scopeData = parseScope(body)

  if (!CATEGORIES.includes(category as any) || !label || amount === null || !scopeData.ok) {
    return NextResponse.json({ error: "Regla invalida" }, { status: 400 })
  }

  const rule = await prisma.tradeInDeductionRule.create({
    data: {
      tenantId,
      category: category as any,
      label,
      amount,
      scope: scopeData.scope,
      modelName: scopeData.modelName,
      capacityGB: scopeData.capacityGB,
      sortOrder,
      isActive: body.isActive !== false,
    },
  })

  return NextResponse.json({ ...rule, amount: String(rule.amount) }, { status: 201 })
}
