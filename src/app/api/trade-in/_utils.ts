import prisma from "@/lib/prisma"
import { Prisma } from "@prisma/client"

export const TRADE_IN_ALLOWED_STATES = ["EN_STOCK", "EN_CAMINO"] as const

const DEFAULT_BATTERY_RANGES = [
  { label: "0 - 79", minPct: 0, maxPct: 79, sortOrder: 1 },
  { label: "80 - 89", minPct: 80, maxPct: 89, sortOrder: 2 },
  { label: "90 - 100", minPct: 90, maxPct: 100, sortOrder: 3 },
]

const DEFAULT_DEDUCTION_RULES = [
  ["PANTALLA_MODULO", "Pantalla impecable", 0, 1],
  ["PANTALLA_MODULO", "Modulo cambiado", 0, 2],
  ["PANTALLA_MODULO", "Pantalla marcada", 0, 3],
  ["PANTALLA_MODULO", "Pantalla rota", 0, 4],
  ["TAPA", "Tapa impecable", 0, 1],
  ["TAPA", "Tapa marcada", 0, 2],
  ["TAPA", "Tapa rota", 0, 3],
  ["CAMARA", "Camara OK", 0, 1],
  ["CAMARA", "Camara con detalle", 0, 2],
  ["CAMARA", "Camara fallando", 0, 3],
  ["FUNCIONAMIENTO", "Funciona perfecto", 0, 1],
  ["FUNCIONAMIENTO", "Face ID fallando", 0, 2],
  ["FUNCIONAMIENTO", "Parlante/microfono fallando", 0, 3],
  ["FUNCIONAMIENTO", "Otro detalle funcional", 0, 4],
] as const

type AuthSession = {
  user: {
    tenantId?: string | null
  }
}

export function getTenantId(session?: AuthSession) {
  return process.env.DEFAULT_TENANT_ID ?? session?.user?.tenantId ?? null
}

export function moneyString(value: Prisma.Decimal | number | string | null | undefined) {
  if (value === null || value === undefined) return "0"
  return String(value)
}

export function toNonNegativeMoney(value: unknown) {
  const n = Number(value)
  if (!Number.isFinite(n) || n < 0) return null
  return new Prisma.Decimal(n.toFixed(2))
}

export function toInteger(value: unknown) {
  const n = Number(value)
  if (!Number.isInteger(n)) return null
  return n
}

export async function ensureTradeInDefaults(tenantId: string) {
  const [rangeCount, ruleCount] = await Promise.all([
    prisma.tradeInBatteryRange.count({ where: { tenantId } }),
    prisma.tradeInDeductionRule.count({ where: { tenantId } }),
  ])

  if (rangeCount === 0) {
    await prisma.tradeInBatteryRange.createMany({
      data: DEFAULT_BATTERY_RANGES.map((range) => ({ ...range, tenantId })),
    })
  }

  if (ruleCount === 0) {
    await prisma.tradeInDeductionRule.createMany({
      data: DEFAULT_DEDUCTION_RULES.map(([category, label, amount, sortOrder]) => ({
        tenantId,
        category,
        label,
        amount,
        sortOrder,
      })),
    })
  }
}

export async function hasOverlappingBatteryRange(tenantId: string, minPct: number, maxPct: number, excludeId?: string) {
  const overlap = await prisma.tradeInBatteryRange.findFirst({
    where: {
      tenantId,
      isActive: true,
      ...(excludeId ? { id: { not: excludeId } } : {}),
      minPct: { lte: maxPct },
      maxPct: { gte: minPct },
    },
    select: { id: true },
  })

  return Boolean(overlap)
}

export function serializeTradeInConfig(data: {
  batteryRanges: {
    id: string
    label: string
    minPct: number
    maxPct: number
    sortOrder: number
    isActive: boolean
  }[]
  deductionRules: {
    id: string
    category: string
    label: string
    amount: Prisma.Decimal
    scope: string
    modelName: string | null
    capacityGB: number | null
    isActive: boolean
    sortOrder: number
  }[]
  prices: {
    id: string
    modelName: string
    capacityGB: number
    batteryRangeId: string
    referencePrice: Prisma.Decimal
  }[]
}) {
  return {
    batteryRanges: data.batteryRanges,
    deductionRules: data.deductionRules.map((rule) => ({ ...rule, amount: moneyString(rule.amount) })),
    prices: data.prices.map((price) => ({ ...price, referencePrice: moneyString(price.referencePrice) })),
  }
}
