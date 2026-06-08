"use client"

import type { Buyer } from "@prisma/client"
import BuyerSection from "@/components/sales/BuyerSection"
import type { CustomerKind } from "@/components/sales/types"

export default function SaleBuyerStep({
  buyer,
  setBuyer,
  customerKind,
  setCustomerKind,
  disabled,
}: {
  buyer: Buyer | null
  setBuyer: (buyer: Buyer | null) => void
  customerKind: CustomerKind
  setCustomerKind: (kind: CustomerKind) => void
  disabled?: boolean
}) {
  return (
    <div className="space-y-4">
      <div className="join">
        <button type="button" className={`btn btn-sm join-item ${customerKind === "retail" ? "btn-primary" : "btn-outline"}`} onClick={() => setCustomerKind("retail")} disabled={disabled}>
          Minorista
        </button>
        <button type="button" className={`btn btn-sm join-item ${customerKind === "wholesale" ? "btn-primary" : "btn-outline"}`} onClick={() => setCustomerKind("wholesale")} disabled={disabled}>
          Mayorista
        </button>
      </div>
      <BuyerSection selectedBuyer={buyer} setSelectedBuyer={setBuyer} disabled={disabled} />
      {customerKind === "wholesale" ? (
        <div className="alert alert-info py-3 text-sm">
          Los datos mayoristas adicionales se registran en las notas comerciales de la venta hasta tener campos dedicados.
        </div>
      ) : null}
    </div>
  )
}
