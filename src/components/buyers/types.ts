import type { BuyerType } from "@prisma/client"

export type SerializedBuyer = {
  id: string
  tenantId: string
  type: BuyerType
  name: string
  surname: string | null
  businessName: string | null
  dob: string | null
  province: string | null
  city: string | null
  postalCode: string | null
  notes: string | null
  phone: string | null
  instagram: string | null
  email: string | null
  addressStreet: string | null
  addressNumber: string | null
  cuit: string | null
  dni: string | null
  createdAt: string | null
  updatedAt: string | null
}

export type BuyerTypeFilter = "ALL" | BuyerType

export type BuyersFilters = {
  type: BuyerTypeFilter
  customer: string
  phone: string
  instagram: string
  email: string
  cuit: string
  dni: string
  province: string
  city: string
}
