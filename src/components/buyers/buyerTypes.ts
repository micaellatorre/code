import type { BuyerType } from "@prisma/client"
import type { BuyerTypeFilter } from "./types"

export const BUYER_TYPES: BuyerType[] = ["MINORISTA", "MAYORISTA"]

export const BUYER_TYPE_LABELS: Record<BuyerType, string> = {
  MINORISTA: "Minorista",
  MAYORISTA: "Mayorista",
}

export const BUYER_TYPE_FILTERS: { value: BuyerTypeFilter; label: string }[] = [
  { value: "ALL", label: "Todos" },
  { value: "MINORISTA", label: "Minorista" },
  { value: "MAYORISTA", label: "Mayorista" },
]

export function isBuyerType(value: unknown): value is BuyerType {
  return value === "MINORISTA" || value === "MAYORISTA"
}
