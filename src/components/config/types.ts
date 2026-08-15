export type ConfigTabKey = "ajustes" | "catalogos" | "equipo"

export type SettingsDto = {
  id: string
  tenantId: string
  servicePickupAlertDays: number
  stockRotationHighMaxDays: number
  stockRotationMediumMaxDays: number
  accessoryLowStockThreshold: number
  wholesalePricesEnabled: boolean
  closerCommissionsEnabled: boolean
  financialFeeEnabled: boolean
  financialFeeRatePct: string
  bnaInstallmentsEnabled: boolean
  bnaMarkupRatePct: string
  bnaDefaultInstallments: number
  bnaCustomerRebatePct: string
  bnaCustomerRebateCapArs: string
  usedDeviceWarrantyDays: number
  warrantyPolicyText: string
}

export type SettingsPayload = {
  tenant: { id: string; name: string }
  settings: SettingsDto
  logo: null | {
    id: string
    fileName: string
    mimeType: string
    sizeBytes: number
    updatedAt: string
    url: string
  }
  activeCommissionPlans: number
}

export type CatalogModel = {
  id: string
  type: "PHONE" | "ACCESSORY"
  name: string
  normalizedName: string
  source: "BASE" | "CUSTOM" | "LEGACY"
  isActive: boolean
  sortOrder: number
  _count?: {
    products?: number
    phoneCompatibilities?: number
    accessoryCompatibilities?: number
  }
}

export type CatalogCapacity = {
  id: string
  capacityGB: number
  label: string
  source: "BASE" | "CUSTOM" | "LEGACY"
  isActive: boolean
}

export type CatalogMeasure = {
  id: string
  label: string
  millimeters: string
  source: "BASE" | "CUSTOM" | "LEGACY"
  isActive: boolean
}

export type CatalogColor = {
  id: string
  name: string
  normalizedName: string
  hexColor: string
  source: "BASE" | "CUSTOM" | "LEGACY"
  isActive: boolean
  aliases: { id: string; alias: string; normalizedAlias: string }[]
}

export type CatalogCompatibility = {
  id: string
  phoneModelId: string
  accessoryModelId: string
  sortOrder: number
  isActive: boolean
  phoneModel: { id: string; name: string }
  accessoryModel: { id: string; name: string }
}

export type CatalogPayload = {
  counts: Record<"devices" | "accessories" | "capacities" | "measures" | "colors", number>
  baseCounts: Record<"devices" | "accessories" | "capacities" | "measures" | "colors", number>
  models: CatalogModel[]
  capacities: CatalogCapacity[]
  measures: CatalogMeasure[]
  colors: CatalogColor[]
  compatibilities: CatalogCompatibility[]
}
