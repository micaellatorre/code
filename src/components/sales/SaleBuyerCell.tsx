"use client"

import Link from "next/link"
import type { SerializedSale } from "./types"

export default function SaleBuyerCell({ sale }: { sale: SerializedSale }) {
  const buyerName = sale.buyer ? [sale.buyer.name, sale.buyer.surname].filter(Boolean).join(" ") : sale.customerName || "Consumidor Final"
  const isWholesale = Boolean(sale.buyer?.email || sale.buyer?.phone)

  return (
    <div className="min-w-44">
      {sale.buyer?.id ? (
        <Link href={`/dashboard/buyers/${sale.buyer.id}/edit`} className="font-medium text-primary hover:underline">
          {buyerName}
        </Link>
      ) : (
        <p className="font-medium">{buyerName}</p>
      )}
      <span className="badge badge-outline badge-xs mt-1">{isWholesale ? "MAY" : "MIN"}</span>
    </div>
  )
}
