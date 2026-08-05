// code/src/components/products/utils.ts

import type { SerializedProduct } from "./types"
import { getProductDisplayCapacityGB, getProductDisplayModel } from "@/lib/products/display"

export function formatDecimal(value: unknown) {
  if (value == null) return "-"
  if (typeof value === "string") {
    const n = parseFloat(value)
    return Number.isFinite(n) ? n.toFixed(2) : value
  }
  if (typeof value === "number") return value.toFixed(2)
  try {
    const s = String(value)
    const n = parseFloat(s)
    return Number.isFinite(n) ? n.toFixed(2) : s
  } catch {
    return String(value)
  }
}

export function normalizeModelKey(modelName: string | null | undefined) {
  return (modelName ?? "").trim().toLowerCase()
}

export function parseNumberOrNull(v: string | null) {
  if (v == null) return null
  const n = parseFloat(v)
  return Number.isFinite(n) ? n : null
}

export function rangeLabelFromItems(items: SerializedProduct[], field: "costPrice" | "salePrice") {
  const nums = items
    .map((p) => parseNumberOrNull(p[field]))
    .filter((n): n is number => n != null)
  if (nums.length === 0) return "-"
  let min = nums[0]
  let max = nums[0]
  for (const n of nums) {
    if (n < min) min = n
    if (n > max) max = n
  }
  if (min === max) return min.toFixed(2)
  return `${min.toFixed(2)} – ${max.toFixed(2)}`
}

export function newestCreatedAt(items: SerializedProduct[]) {
  let best = 0
  for (const p of items) {
    const t = p.createdAt ? new Date(p.createdAt).getTime() : 0
    if (t > best) best = t
  }
  return best
}

export function getIphoneSeries(modelName: string | null) {
  const normalized = (modelName ?? "").toUpperCase()
  if (/\bIPHONE\s+SE\b/.test(normalized)) return "SE Series"
  const match = normalized.match(/\bIPHONE\s*(\d{1,2})\b/)
  return match ? `${match[1]} Series` : "Otros"
}

export function getSeriesSortValue(series: string) {
  if (series === "Otros") return -2
  if (series === "SE Series") return -1
  const value = Number.parseInt(series, 10)
  return Number.isFinite(value) ? value : -2
}

export function isSealedPhone(product: SerializedProduct) {
  const normalized = (product.condition ?? "").trim().toUpperCase()
  return ["SEALED", "SELLADO", "NEW", "NUEVO", "NUEVA"].includes(normalized)
}

export function getCapacityNumber(product: SerializedProduct) {
  const value = Number(getProductDisplayCapacityGB(product))
  return Number.isFinite(value) ? value : 0
}

export function getProductCode(product: SerializedProduct) {
  const sku = (product as SerializedProduct & { sku?: unknown }).sku
  return typeof sku === "string" && sku.trim() ? sku : product.id.slice(-6).toUpperCase()
}

export function compareIphoneModels(a: SerializedProduct, b: SerializedProduct) {
  const getTier = (modelName: string) => {
    const normalized = modelName.toUpperCase()
    if (normalized.includes("PRO MAX")) return 5
    if (normalized.includes("PRO")) return 4
    if (normalized.includes("PLUS")) return 3
    if (normalized.includes("MINI")) return 1
    if (normalized.includes("SE")) return 0
    return 2
  }
  return (
    getTier(getProductDisplayModel(b)) - getTier(getProductDisplayModel(a)) ||
    getCapacityNumber(b) - getCapacityNumber(a) ||
    new Date(a.createdAt ?? 0).getTime() - new Date(b.createdAt ?? 0).getTime()
  )
}
