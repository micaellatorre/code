// code/src/components/products/types.ts

type SerializedProduct = {
  id: string
  tenantId: string
  type: string
  brand: string | null
  imei: string | null
  modelName: string
  capacityGB: number | string | null | any
  condition: string | null
  color: string | null
  batteryPct: number | null
  purchaseDate: string | null
  costPrice: string | null
  salePrice: string | null
  shippingCost: string | null
  state: string
  senado: boolean
  senadoAt: string | null
  status: string
  stockInitial: number
  stock: number
  stockAvailable: number
  notes: string | null
  location: string | null
  branchId: string | null
  branch?: { id: string; code: string; name: string } | null
  supplierId: string | null
  supplier?: { id: string; name: string } | null
  origin: string | null
  createdAt: string | null
  updatedAt: string | null
}

type ProductsApiResponse = {
  products: SerializedProduct[]
  nextCursor: string | null
  totalProducts?: number | null
}

type InventorySegment = "PHONES" | "ACCESSORIES" | "TRADE_INS"

export type { SerializedProduct, ProductsApiResponse, InventorySegment }
