"use client"

import SaleMetaSection from "@/components/sales/SaleMetaSection"
import type { SaleMeta } from "@/components/sales/types"

export default function SaleMetaStep({ meta, setMeta, disabled }: { meta: SaleMeta; setMeta: (meta: SaleMeta) => void; disabled?: boolean }) {
  return <SaleMetaSection meta={meta} setMeta={setMeta} disabled={disabled} />
}
