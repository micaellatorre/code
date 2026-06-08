"use client"

import { formatUsd } from "./salesUtils"

export default function SaleAmountCell({ total }: { total: string | null }) {
  return <span className="font-semibold">{formatUsd(total)}</span>
}
