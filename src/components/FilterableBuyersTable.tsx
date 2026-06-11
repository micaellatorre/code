"use client"

import BuyersTable from "@/components/buyers/BuyersTable"
import type { SerializedBuyer } from "@/components/buyers/types"

export default function FilterableBuyersTable({ initial }: { initial: SerializedBuyer[] }) {
  return <BuyersTable initial={initial} />
}
