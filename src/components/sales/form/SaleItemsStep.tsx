"use client"

import SaleItemsSection from "@/components/sales/SaleItemsSection"
import type { SaleItemDraft } from "@/components/sales/types"

export default function SaleItemsStep({
  items,
  setItems,
  disabled,
  branchId,
  saleType = "MINORISTA",
}: {
  items: SaleItemDraft[]
  setItems: (items: SaleItemDraft[]) => void
  disabled?: boolean
  branchId?: string | null
  saleType?: "MINORISTA" | "MAYORISTA"
}) {
  return <SaleItemsSection items={items} setItems={setItems} disabled={disabled} branchId={branchId} saleType={saleType} />
}
