import type { Role } from "@/lib/auth/roles"

export type DashboardRole = Extract<Role, "ADMIN" | "SOCIO">

export type CompareMode = "none" | "previous" | "yoy"

export type DashboardProductTypeFilter = "ALL" | "PHONE" | "ACCESSORY"

export type DashboardProductType = Exclude<DashboardProductTypeFilter, "ALL">

export type DashboardProductMetricMode = "units" | "profit"

export type DashboardWidgetKey =
  | "kpis"
  | "alerts"
  | "revenueTrend"
  | "stockComposition"
  | "appointmentsFunnel"
  | "topProducts"
  | "criticalStock"
  | "inventoryAging"
  | "systemStats"

export type DashboardKpi = {
  key: string
  title: string
  value: string | number
  subtitle?: string
  trend?: number
  tone?: "default" | "success" | "warning" | "error" | "info"
  sensitive?: boolean
}

export type DashboardAlert = {
  id: string
  severity: "Alta" | "Media" | "Baja"
  description: string
}

export type DashboardBarItem = {
  name: string
  value: number
}

export type DashboardTrendProductSummary = {
  id: string
  name: string
  type: DashboardProductType
  units: number
  revenue: number
  profit: number
}

export type DashboardTrendPointDetail = {
  dateKey: string
  label: string
  revenue: number
  profit: number
  salesCount: number
  comparisonRevenue?: number
  products: DashboardTrendProductSummary[]
}

export type DashboardRevenueTrendPoint = {
  date: string
  dateKey: string
  Ingresos?: number
  Utilidad?: number
  Actual?: number
  Comparacion?: number
}

export type DashboardProductInsightItem = {
  id: string
  name: string
  type: DashboardProductType
  unitsSold: number
  revenue: number
  profit: number
}

export type DashboardInventoryInsightItem = {
  id: string
  name: string
  type: DashboardProductType
  stockAvailable: number
  stockTotal: number
  stockInitial: number
  state: string
  status: string
  daysInInventory: number
}

export type DashboardStockCompositionItem = {
  name: string
  value: number
  type: DashboardProductType
}

export type DashboardInteractiveDefaults = {
  productTypeFilter: DashboardProductTypeFilter
  criticalStockThreshold: number
  agingDaysThreshold: number
  topProductsMetric: DashboardProductMetricMode
}

export type DashboardRange = {
  from: string
  to: string
  label: string
}

export type DashboardOverviewData = {
  role: DashboardRole
  range: DashboardRange
  compare: CompareMode
  compareRange: DashboardRange | null
  defaults: DashboardInteractiveDefaults
  kpis: DashboardKpi[]
  alerts: DashboardAlert[]
  revenueTrend: DashboardRevenueTrendPoint[]
  revenueCategories: string[]
  revenueTrendDetails: DashboardTrendPointDetail[]
  stockComposition: DashboardStockCompositionItem[]
  appointmentsFunnel: DashboardBarItem[]
  topProducts: DashboardProductInsightItem[]
  inventoryProducts: DashboardInventoryInsightItem[]
  systemStats: DashboardBarItem[]
}
