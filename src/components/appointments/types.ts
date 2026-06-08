import type {
  AppointmentNoSaleReason,
  AppointmentOutcome,
  AppointmentStatus,
  PaymentMethod,
  ProductState,
  ProductType,
} from "@prisma/client"
import type { Role } from "@/lib/auth/roles"

export type AppointmentUserSummary = {
  id: string
  name: string | null
  email: string
}

export type AppointmentBuyerSummary = {
  id: string
  name: string
  phone: string | null
  instagram: string | null
  email?: string | null
}

export type AppointmentProductSummary = {
  id: string
  type: ProductType | string
  modelName: string
  capacityGB: number | null
  condition: string | null
  batteryPct: number | null
  color: string | null
  imei: string | null
  salePrice: number | null
  state: ProductState | string | null
  senado: boolean
  location: string | null
  stock: number | null
  stockAvailable: number | null
}

export type AppointmentInterestSummary = {
  id: string
  productId: string
  priority: number | null
  notes: string | null
  product: AppointmentProductSummary
}

export type SerializedAppointment = {
  id: string
  scheduledAt: string
  durationMinutes: number | null
  status: AppointmentStatus
  outcome: AppointmentOutcome
  noSaleReason: AppointmentNoSaleReason | null
  noSaleReasonOther?: string | null
  buyer: AppointmentBuyerSummary | null
  interests: AppointmentInterestSummary[]
  resultNotes: string | null
  saleId: string | null
  createdBy: string
  createdByUser: AppointmentUserSummary | null
}

export type AppointmentStatusSegment = "active" | "cancelled" | "sold"

export type UserSearchResult = {
  id: string
  name: string | null
  email: string
  role: Role
}

export type AppointmentKpis = {
  activeCount: number
  depositsTotal: number
  reservedValue: number
}

export type AppointmentDepositDraft = {
  id: string
  amount: number
  method: PaymentMethod
  currency: "ARS" | "USD" | "USDT"
  notes: string
}
