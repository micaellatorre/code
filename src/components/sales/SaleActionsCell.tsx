"use client"

import Link from "next/link"
import { DocumentTextIcon, PencilIcon, TruckIcon, XCircleIcon } from "@heroicons/react/24/outline"
import type { SerializedSale } from "./types"

type SaleActionsCellProps = {
  sale: SerializedSale
  canCancel: boolean
  canEdit: boolean
  canEditConfirmed: boolean
  onReceipt: () => void
  onTransport: () => void
  onCancel: () => void
}

export default function SaleActionsCell({ sale, canCancel, canEdit, canEditConfirmed, onReceipt, onTransport, onCancel }: SaleActionsCellProps) {
  const editAllowed = canEdit && (sale.status !== "CONFIRMADA" || canEditConfirmed)

  return (
    <div className="flex items-center gap-1">
      <button type="button" className="btn btn-square btn-ghost btn-xs" title="Recibo" onClick={onReceipt}>
        <DocumentTextIcon className="size-4" />
      </button>
      <button type="button" className="btn btn-square btn-ghost btn-xs" title="Transporte" onClick={onTransport}>
        <TruckIcon className="size-4" />
      </button>
      {canCancel ? (
        <button type="button" className="btn btn-square btn-ghost btn-xs text-error" title="Cancelar" onClick={onCancel}>
          <XCircleIcon className="size-4" />
        </button>
      ) : null}
      {editAllowed ? (
        <Link href={`/dashboard/sales/${sale.id}/edit`} className="btn btn-square btn-ghost btn-xs" title="Editar">
          <PencilIcon className="size-4" />
        </Link>
      ) : null}
    </div>
  )
}
