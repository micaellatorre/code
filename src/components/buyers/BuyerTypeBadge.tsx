"use client"

import type { BuyerType } from "@prisma/client"
import { BUYER_TYPE_LABELS } from "./buyerTypes"

export default function BuyerTypeBadge({ type }: { type: BuyerType }) {
  const badgeClass = type === "MAYORISTA" ? "badge-warning" : "badge-info"

  return <span className={`badge badge-outline badge-sm ${badgeClass}`}>{BUYER_TYPE_LABELS[type]}</span>
}
