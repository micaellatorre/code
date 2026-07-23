"use client"

import Link from "next/link"
import { ArrowPathIcon } from "@heroicons/react/24/outline"
import type { SerializedSale } from "./types"

export default function SaleBuyerCell({
  sale,
  canEditCustomer = false,
  onOpenCustomerModal,
}: {
  sale: SerializedSale
  canEditCustomer?: boolean
  onOpenCustomerModal?: () => void
}) {
  const buyerName = sale.buyer ? [sale.buyer.name, sale.buyer.surname].filter(Boolean).join(" ") : sale.customerName || "Consumidor Final"
  const isWholesale = sale.buyer?.type === "MAYORISTA" || sale.saleType === "MAYORISTA"
  const displayName = isWholesale && sale.buyer?.businessName ? sale.buyer.businessName : buyerName
  const label = isWholesale ? "Mayorista" : "Minorista"

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
      {canEditCustomer ? (
        <button
          type="button"
          className="badge badge-neutral badge-sm group mt-1 min-w-24 cursor-pointer justify-center gap-1 transition-colors hover:border-primary hover:bg-primary hover:text-primary-content"
          title="Asignar cliente"
          aria-label={`Asignar cliente ${label}`}
          onClick={onOpenCustomerModal}
        >
          <span className="group-hover:hidden">{label}</span>
          <span className="hidden items-center gap-1 group-hover:inline-flex">
            <ArrowPathIcon className="size-3" />
            Cambiar
          </span>
        </button>
      ) : (
        <span className="badge badge-neutral badge-sm mt-1">{label}</span>
      )}
    </div>
  )
}
