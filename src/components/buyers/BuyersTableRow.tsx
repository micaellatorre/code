"use client"

import Link from "next/link"
import { PencilIcon, TrashIcon } from "@heroicons/react/24/outline"
import BuyerTypeBadge from "./BuyerTypeBadge"
import {
  formatArgentina,
  formatBuyerAddress,
  formatBuyerLocation,
  getBuyerCode,
  getBuyerDisplayName,
  getBuyerMainDocument,
  getBuyerSecondaryDocument,
  getBuyerSecondaryName,
  hasBuyerContact,
  isDateChanged,
  normalizeInstagram,
} from "./buyerUtils"
import type { SerializedBuyer } from "./types"

type BuyersTableRowProps = {
  buyer: SerializedBuyer
  canEdit: boolean
  canDelete: boolean
  isDeleting: boolean
  onDelete: () => void
}

export default function BuyersTableRow({ buyer, canEdit, canDelete, isDeleting, onDelete }: BuyersTableRowProps) {
  const instagram = normalizeInstagram(buyer.instagram)
  const displayName = getBuyerDisplayName(buyer)
  const secondaryName = getBuyerSecondaryName(buyer)
  const mainDocument = getBuyerMainDocument(buyer)
  const secondaryDocument = getBuyerSecondaryDocument(buyer)
  const location = formatBuyerLocation(buyer)
  const address = formatBuyerAddress(buyer)
  const hasContact = hasBuyerContact(buyer)
  const showUpdatedAt = isDateChanged(buyer.createdAt, buyer.updatedAt)

  return (
    <tr className="hover:bg-base-200/40">
      <td className="align-top">
        <div className="min-w-52">
          {canEdit ? (
            <Link href={`/dashboard/buyers/${buyer.id}/edit`} className="font-semibold text-primary hover:underline">
              {displayName}
            </Link>
          ) : (
            <p className="font-semibold">{displayName}</p>
          )}
          {secondaryName ? <p className="text-xs text-base-content/60">{secondaryName}</p> : null}
          <span className="badge badge-neutral badge-xs mt-2">{getBuyerCode(buyer)}</span>
        </div>
      </td>
      <td className="align-top">
        <BuyerTypeBadge type={buyer.type} />
      </td>
      <td className="align-top">
        <div className="min-w-32">
          <p className="font-medium">{mainDocument}</p>
          {secondaryDocument ? <p className="text-xs text-base-content/60">{secondaryDocument}</p> : null}
        </div>
      </td>
      <td className="align-top">
        <div className="min-w-44 space-y-1 text-sm">
          {buyer.phone ? <p className="font-medium">{buyer.phone}</p> : null}
          {instagram ? (
            <a
              href={`https://www.instagram.com/${instagram}`}
              target="_blank"
              rel="noopener noreferrer"
              className="block text-primary hover:underline"
            >
              @{instagram}
            </a>
          ) : null}
          {buyer.email ? <p className="break-all text-xs text-base-content/60">{buyer.email}</p> : null}
          {!hasContact ? <span className="badge badge-ghost badge-sm">Sin contacto</span> : null}
        </div>
      </td>
      <td className="align-top">
        <div className="min-w-44 space-y-1">
          {location ? <p className="font-medium">{location}</p> : null}
          {buyer.postalCode ? <p className="text-xs text-base-content/60">CP {buyer.postalCode}</p> : null}
          {address ? <p className="text-xs text-base-content/60">{address}</p> : null}
          {!location && !buyer.postalCode && !address ? <span className="text-base-content/50">—</span> : null}
        </div>
      </td>
      <td className="align-top">
        <div className="min-w-36 space-y-1 text-sm">
          <p className="font-medium">Alta: {formatArgentina(buyer.createdAt)}</p>
          {showUpdatedAt ? <p className="text-xs text-base-content/60">Editado: {formatArgentina(buyer.updatedAt)}</p> : null}
        </div>
      </td>
      {canEdit || canDelete ? (
        <td className="align-top">
          <div className="flex items-center justify-end gap-1">
            {canEdit ? (
              <Link href={`/dashboard/buyers/${buyer.id}/edit`} className="btn btn-square btn-ghost btn-xs" title="Editar">
                <PencilIcon className="size-4" />
              </Link>
            ) : null}
            {canDelete ? (
              <button
                type="button"
                className="btn btn-square btn-ghost btn-xs text-error"
                onClick={onDelete}
                disabled={isDeleting}
                title="Eliminar"
              >
                {isDeleting ? <span className="loading loading-spinner loading-xs" /> : <TrashIcon className="size-4" />}
              </button>
            ) : null}
          </div>
        </td>
      ) : null}
    </tr>
  )
}
