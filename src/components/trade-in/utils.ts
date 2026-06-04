import type { TradeInDeductionCategory, TradeInDeductionRuleDto } from "./types"

export const TRADE_IN_CATEGORY_LABELS: Record<TradeInDeductionCategory, string> = {
  PANTALLA_MODULO: "Pantalla/Modulo",
  TAPA: "Tapa",
  CAMARA: "Camara",
  FUNCIONAMIENTO: "Funcionamiento",
  OTRO: "Otro",
}

export const TRADE_IN_CATEGORIES = Object.keys(TRADE_IN_CATEGORY_LABELS) as TradeInDeductionCategory[]

export function numericInputValue(value: number | string | null | undefined) {
  if (value === null || value === undefined) return ""
  return String(value)
}

export function getRulesByCategory(rules: TradeInDeductionRuleDto[], category: TradeInDeductionCategory) {
  return rules
    .filter((rule) => rule.category === category && rule.isActive)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label))
}

export function getApplicableRulesByCategory(rules: TradeInDeductionRuleDto[], category: TradeInDeductionCategory, modelName: string, capacityGB: number | null) {
  return getRulesByCategory(rules, category).filter((rule) => {
    if (rule.scope === "GLOBAL") return true
    if (rule.scope === "MODEL") return Boolean(modelName) && rule.modelName === modelName
    return Boolean(modelName) && capacityGB != null && rule.modelName === modelName && rule.capacityGB === capacityGB
  })
}

export function parseApiMoney(value: string | number | null | undefined) {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

export function makeClientId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}
