"use client"

import Link from "next/link"
import type { SerializedSale } from "./types"

export default function SaleBuyerCell({ sale }: { sale: SerializedSale }) {
  const buyerName = sale.buyer ? [sale.buyer.name, sale.buyer.surname].filter(Boolean).join(" ") : sale.customerName || "Consumidor Final"
  const isWholesale = sale.buyer?.type === "MAYORISTA"
  const displayName = isWholesale && sale.buyer?.businessName ? sale.buyer.businessName : buyerName

  return (
    <div className="min-w-44 flex flex-col items-start gap-2">
      {sale.buyer?.id ? (
        <Link href={`/dashboard/buyers/${sale.buyer.id}/edit`} className="font-medium text-primary hover:underline">
          {displayName}
        </Link>
      ) : (
        <p className="font-medium">{displayName}</p>
      )}
      {isWholesale && sale.buyer?.businessName ? <p className="text-xs text-base-content/60">{buyerName}</p> : null}
      <span className="badge badge-neutral badge-sm mt-1">{isWholesale ? "Mayorista" : "Minorista"}</span>
    </div>
  )
}
