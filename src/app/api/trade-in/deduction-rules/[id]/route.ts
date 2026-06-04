import prisma from "@/lib/prisma"
import { requireRoleApi } from "@/lib/auth/auth"
import { NextResponse } from "next/server"
import { getTenantId, toInteger, toNonNegativeMoney } from "../../_utils"

const CATEGORIES = ["PANTALLA_MODULO", "TAPA", "CAMARA", "FUNCIONAMIENTO", "OTRO"] as const
const SCOPES = ["GLOBAL", "MODEL", "MODEL_CAPACITY"] as const

type Params = {
  params: Promise<{ id: string }>
}

function normalizeScope(scopeValue: unknown, modelValue: unknown, capacityValue: unknown) {
  const scope = SCOPES.includes(scopeValue as any) ? scopeValue as typeof SCOPES[number] : "GLOBAL"
  const modelName = typeof modelValue === "string" && modelValue.trim() ? modelValue.trim() : null
  const capacityGB = capacityValue === null || capacityValue === "" || capacityValue === undefined ? null : toInteger(capacityValue)

  if (scope === "GLOBAL") return { ok: true as const, scope, modelName: null, capacityGB: null }
  if (scope === "MODEL") return modelName ? { ok: true as const, scope, modelName, capacityGB: null } : { ok: false as const }
  if (capacityGB === null) return { ok: false as const }
  return modelName ? { ok: true as const, scope, modelName, capacityGB } : { ok: false as const }
}

export async function PATCH(request: Request, { params }: Params) {
  const auth = await requireRoleApi(["ADMIN"])
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: auth.status })

  const tenantId = getTenantId(auth.session)
  if (!tenantId) return NextResponse.json({ error: "DEFAULT_TENANT_ID not set" }, { status: 500 })

  const { id } = await params
  const current = await prisma.tradeInDeductionRule.findFirst({ where: { id, tenantId } })
  if (!current) return NextResponse.json({ error: "Regla no encontrada" }, { status: 404 })

  const body = await request.json()
  const category = body.category === undefined ? current.category : String(body.category)
  const label = body.label === undefined ? current.label : String(body.label).trim()
  const amount = body.amount === undefined ? current.amount : toNonNegativeMoney(body.amount)
  const sortOrder = body.sortOrder === undefined ? current.sortOrder : toInteger(body.sortOrder)
  const isActive = body.isActive === undefined ? current.isActive : Boolean(body.isActive)
  const scopeData = normalizeScope(body.scope === undefined ? current.scope : body.scope, body.modelName === undefined ? current.modelName : body.modelName, body.capacityGB === undefined ? current.capacityGB : body.capacityGB)

  if (!CATEGORIES.includes(category as any) || !label || amount === null || sortOrder === null || !scopeData.ok) {
    return NextResponse.json({ error: "Regla invalida" }, { status: 400 })
  }

  const rule = await prisma.tradeInDeductionRule.update({
    where: { id },
    data: {
      category: category as any,
      label,
      amount,
      scope: scopeData.scope,
      modelName: scopeData.modelName,
      capacityGB: scopeData.capacityGB,
      sortOrder,
      isActive,
    },
  })

  return NextResponse.json({ ...rule, amount: String(rule.amount) })
}

export async function DELETE(_request: Request, { params }: Params) {
  const auth = await requireRoleApi(["ADMIN"])
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: auth.status })

  const tenantId = getTenantId(auth.session)
  if (!tenantId) return NextResponse.json({ error: "DEFAULT_TENANT_ID not set" }, { status: 500 })

  const { id } = await params
  const current = await prisma.tradeInDeductionRule.findFirst({ where: { id, tenantId } })
  if (!current) return NextResponse.json({ error: "Regla no encontrada" }, { status: 404 })

  const rule = await prisma.tradeInDeductionRule.update({
    where: { id },
    data: { isActive: false },
  })

  return NextResponse.json({ ...rule, amount: String(rule.amount) })
}
