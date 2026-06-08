"use client"

import SalesDashboard from "@/components/sales/SalesDashboard"
import type { SerializedSale } from "@/components/sales/types"

export default function FilterableSalesTable({ initial }: { initial: SerializedSale[] }) {
  return <SalesDashboard initial={initial} />
}
