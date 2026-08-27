import type { Buyer, BuyerType, Currency, PaymentMethod, Product, SaleItemKind, SaleStatus } from "@prisma/client"
import type { Role } from "@/lib/auth/roles"
import type { ProductCatalogDisplayCapacity, ProductCatalogDisplayColor, ProductCatalogDisplayModel, ProductCatalogDisplayProduct } from "@/lib/products/display"
import type { TradeInDeviceDraft } from "@/components/trade-in/types"

export type SaleUserSummary = {
  id: string
  name: string | null
  email: string
}

export type SaleBuyerSummary = {
  id?: string
  type?: BuyerType | string
  name: string
  surname: string | null
  businessName?: string | null
  phone?: string | null
  instagram?: string | null
  email?: string | null
}

export type SaleProductSummary = {
  id?: string
  modelName: string
  type: string
  capacityGB: number | null
  condition?: string | null
  batteryPct?: number | null
  color?: string | null
  imei: string | null
  state?: string | null
  stock?: number | null
  stockAvailable?: number | null
  salePrice?: string | null
  catalogModelId?: string | null
  catalogCapacityId?: string | null
  catalogColorId?: string | null
  catalogModel?: ProductCatalogDisplayModel | null
  catalogCapacity?: ProductCatalogDisplayCapacity | null
  catalogColor?: ProductCatalogDisplayColor | null
}

export type SaleItemSummary = {
  id: string
  saleId: string
  productId: string
  parentItemId?: string | null
  units: number
  kind: SaleItemKind | string
  unitPrice: string | null
  unitCost?: string | null
  extraCost?: string | null
  lineTotal: string | null
  lineCost?: string | null
  lineProfit?: string | null
  product: SaleProductSummary
}

export type SalePaymentSummary = {
  id?: string
  method: PaymentMethod | string
  currency: Currency | string
  amount: string | null
  exchangeRate?: string | null
  amountUsd?: string | null
  coveredBaseUsd?: string | null
  surchargePct?: string | null
  surchargeAmount?: string | null
  installments?: number | null
  installmentAmount?: string | null
  pricingSnapshot?: unknown
  cashAccountId?: string | null
  originReservationPaymentId?: string | null
  originCustomerOrderPaymentId?: string | null
  paidAt?: string | null
  note?: string | null
}

export type SerializedSaleReceipt = {
  number: number
  formattedNumber: string
  generatedAt: string
}

export type SerializedSale = {
  id: string
  tenantId: string
  branchId: string | null
  branch?: { id: string; code: string; name: string } | null
  date: string | null
  customerName: string | null
  origin: string | null
  payment: string | null
  notes: string | null
  status: SaleStatus | string | null
  saleType?: "MINORISTA" | "MAYORISTA" | string | null
  amountPaid: string | null
  balanceDue: string | null
  subtotal: string | null
  extraCosts: string | null
  total: string | null
  profit: string | null
  costTotal: string | null
  createdAt: string | null
  buyer: SaleBuyerSummary | null
  createdBy: string
  createdByUser: SaleUserSummary | null
  items: SaleItemSummary[]
  payments: SalePaymentSummary[]
  receipt?: SerializedSaleReceipt | null
  appointments?: { id: string }[]
}

export type ReceiptPreview = {
  sale: SerializedSale
  receipt: SerializedSaleReceipt
  branding?: {
    tenantName: string
    logoDataUrl: string | null
    usedDeviceWarrantyDays: number
    warrantyPolicyText: string
  }
}

export type SaleOriginFilter = "ALL" | "Directa" | "Reserva" | "Instagram" | "Local" | "Otro"
export type SaleStatusFilter = "ALL" | "CONFIRMADA" | "SENADA" | "CANCELADA"

export type SalesKpisValue = {
  totalSales: number
  monthSalesTotal: number
  monthCount: number
  averageTicket: number
  grossMargin: number
}

export type UserSearchResult = {
  id: string
  name: string | null
  email: string
  role: Role
}

export type SaleItemDraft = {
  clientLineId: string
  parentClientLineId?: string | null
  productId: string
  product: Product & ProductCatalogDisplayProduct
  units: number
  unitPrice: string
  unitCost: string
  extraCost: string
  kind: SaleItemKind
  _id: string
}

export type PaymentDraft = {
  id?: string
  method: PaymentMethod
  currency: Currency
  amount: string
  note?: string
  paidAt?: Date
  exchangeRate?: string
  amountUsd?: string
  coveredBaseUsd?: string
  surchargePct?: string
  surchargeAmount?: string
  installments?: number
  installmentAmount?: string
  customerRebatePct?: string
  customerRebateAmount?: string
  cashAccountId?: string
  _id: string
}

export type SaleMeta = {
  date: Date
  origin: string
  customOrigin?: string
  notes?: string
}

export type SaleSubmitMode = "CONFIRM_SALE" | "RESERVE"
export type OperationFlow = "DIRECT" | "RESERVATION"
export type CustomerKind = "retail" | "wholesale"

export type SaleFormInitialData = {
  id: string
  branchId?: string | null
  branch?: { id: string; code: string; name: string } | null
  buyer: Buyer | null
  meta: SaleMeta
  items: SaleItemDraft[]
  payments: PaymentDraft[]
  status: SaleStatus
}

export type SaleFormSuccess = {
  saleId?: string
  customerName: string
  total: number
}

export type SaleTradeInState = {
  devices: TradeInDeviceDraft[]
  creditTotal: number
}
