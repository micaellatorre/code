"use client"

import SaleItemsSection from "@/components/sales/SaleItemsSection"
import type { SaleItemDraft } from "@/components/sales/types"

export default function SaleItemsStep({ items, setItems, disabled }: { items: SaleItemDraft[]; setItems: (items: SaleItemDraft[]) => void; disabled?: boolean }) {
  return <SaleItemsSection items={items} setItems={setItems} disabled={disabled} />
}
