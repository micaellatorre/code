"use client"

import { formatUsd, getMarginBadgeClass } from "./salesUtils"

export default function SaleMarginCell({ profit, canSeeMargin }: { profit: string | null; canSeeMargin: boolean }) {
  if (!canSeeMargin) return <span className="text-sm text-base-content/50">Restringido</span>
  return <span className={`badge badge-outline ${getMarginBadgeClass(profit)}`}>{formatUsd(profit)}</span>
}
