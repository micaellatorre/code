import type { ProductCatalogDisplayCapacity, ProductCatalogDisplayColor, ProductCatalogDisplayModel } from "@/lib/products/display"

export type TradeInDeductionCategory = "PANTALLA_MODULO" | "TAPA" | "CAMARA" | "FUNCIONAMIENTO" | "OTRO"
export type TradeInDeductionScope = "GLOBAL" | "MODEL" | "MODEL_CAPACITY"

export type TradeInBatteryRangeDto = {
  id: string
  label: string
  minPct: number
  maxPct: number
  sortOrder: number
  isActive: boolean
}

export type TradeInPriceDto = {
  id: string
  modelName: string
  capacityGB: number
  batteryRangeId: string
  referencePrice: string
}

export type TradeInDeductionRuleDto = {
  id: string
  category: TradeInDeductionCategory
  label: string
  amount: string
  scope: TradeInDeductionScope
  modelName: string | null
  capacityGB: number | null
  isActive: boolean
  sortOrder: number
}

export type TradeInConfigDto = {
  batteryRanges: TradeInBatteryRangeDto[]
  deductionRules: TradeInDeductionRuleDto[]
  prices: TradeInPriceDto[]
}

export type TradeInDeviceDraft = {
  id: string
  modelName: string
  capacityGB: number
  batteryRangeId: string
  batteryRangeLabel: string
  color?: string
  imei?: string
  condition?: string
  notes?: string
  referencePrice: number
  deductions: {
    id: string
    category: TradeInDeductionCategory
    label: string
    amount: number
  }[]
  finalValue: number
}

export type EligibleProductDto = {
  id: string
  modelName: string
  capacityGB: number | null
  batteryPct: number | null
  color: string | null
  imei: string | null
  state: "EN_STOCK" | "EN_CAMINO"
  senado: boolean
  salePrice: string
  location: string | null
  condition: string | null
  catalogModelId?: string | null
  catalogCapacityId?: string | null
  catalogColorId?: string | null
  catalogModel?: ProductCatalogDisplayModel | null
  catalogCapacity?: ProductCatalogDisplayCapacity | null
  catalogColor?: ProductCatalogDisplayColor | null
}

export type InterestedProductDraft = EligibleProductDto & {
  quotedPrice: number
}
