"use client"

import SaleMetaSection from "@/components/sales/SaleMetaSection"
import type { SaleMeta } from "@/components/sales/types"
import type { BranchOption } from "@/components/branches/BranchAutocomplete"

export default function SaleMetaStep({
  meta,
  setMeta,
  disabled,
  isAdmin,
  branches,
  selectedBranchId,
  setSelectedBranchId,
}: {
  meta: SaleMeta
  setMeta: (meta: SaleMeta) => void
  disabled?: boolean
  isAdmin?: boolean
  branches?: BranchOption[]
  selectedBranchId?: string
  setSelectedBranchId?: (branchId: string) => void
}) {
  return <SaleMetaSection meta={meta} setMeta={setMeta} disabled={disabled} isAdmin={isAdmin} branches={branches} selectedBranchId={selectedBranchId} setSelectedBranchId={setSelectedBranchId} />
}
