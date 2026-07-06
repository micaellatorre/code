import type { BranchOption } from "@/components/branches/BranchAutocomplete"

export type SupplierListItem = {
  id: string
  name: string
  contactName: string | null
  phone: string | null
  email: string | null
  provinceId: string | null
  provinceRef: { id: string; code: string; name: string } | null
  city: string | null
  postalCode: string | null
  addressStreet: string | null
  addressNumber: string | null
  branchId: string | null
  branch: BranchOption | null
  branchCoverages: BranchOption[]
  purchasesCount: number
  lastPurchaseAt: string | null
}

export type SupplierDetail = SupplierListItem & {
  recentPurchases: Array<{
    id: string
    date: string
    currency: string
    totalCost: string
    branch: BranchOption | null
    items: Array<{ id: string; modelName: string; units: number }>
  }>
}

export type ProvinceOption = {
  id: string
  code: string
  name: string
}
