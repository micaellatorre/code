"use client"

import { ArrowPathIcon } from "@heroicons/react/24/outline"
import { formatSaleDate, getSaleOrigin, getStatusBadgeClass, isTodayInArgentina } from "./salesUtils"
import SaleActionsCell from "./SaleActionsCell"
import SaleAmountCell from "./SaleAmountCell"
import SaleBuyerCell from "./SaleBuyerCell"
import SaleItemsCell from "./SaleItemsCell"
import SaleMarginCell from "./SaleMarginCell"
import SaleSellerEditor from "./SaleSellerEditor"
import type { SerializedSale, UserSearchResult } from "./types"
import BranchAutocomplete, { type BranchOption } from "@/components/branches/BranchAutocomplete"

type SalesTableRowProps = {
  sale: SerializedSale
  isAdmin: boolean
  canSeeMargin: boolean
  canCancel: boolean
  canEdit: boolean
  canEditConfirmed: boolean
  onReceipt: () => void
  isReceiptLoading: boolean
  onTransport: () => void
  onCancel: () => void
  onOpenStatusModal: () => void
  sellerProps: {
    isEditing: boolean
    isSearchingUsers: boolean
    isSavingSeller: boolean
    userSearchQuery: string
    userSearchResults: UserSearchResult[]
    editorRef: React.RefObject<HTMLDivElement>
    onOpen: () => void
    onClose: () => void
    onUserSearchQueryChange: (value: string) => void
    onSelectUser: (user: UserSearchResult) => void
  }
  branchProps: {
    branches: BranchOption[]
    isSaving: boolean
    onSelectBranch: (branchId: string) => void
  }
}

export default function SalesTableRow(props: SalesTableRowProps) {
  const { sale } = props
  const origin = getSaleOrigin(sale)
  const canOpenStatusModal = props.canEdit

  return (
    <tr className="hover">
      <td className="align-top">
        <div className="min-w-28">
          <p className="font-medium">{formatSaleDate(sale.date, "dd/MM/yyyy")}</p>
          <p className="text-xs text-base-content/60">{formatSaleDate(sale.date, "HH:mm")}</p>
          {isTodayInArgentina(sale.date) ? <span className="badge badge-info badge-xs mt-1">Hoy</span> : null}
        </div>
      </td>
      <td className="align-top">
        <SaleSellerEditor sale={sale} isAdmin={props.isAdmin} {...props.sellerProps} />
      </td>
      <td className="align-top">
        {props.isAdmin && sale.status !== "CANCELADA" ? (
          <BranchAutocomplete
            value={sale.branchId}
            branches={props.branchProps.branches}
            onChange={props.branchProps.onSelectBranch}
            compact
            loading={props.branchProps.isSaving}
          />
        ) : (
          <span className="text-sm">{sale.branch?.name ?? "Sin sucursal"}</span>
        )}
      </td>
      <td className="align-top">
        <SaleItemsCell items={sale.items} />
      </td>
      <td className="align-top">
        <SaleBuyerCell sale={sale} />
      </td>
      <td className="align-top flex flex-col items-start gap-1">
        <SaleAmountCell total={sale.total} />
        {canOpenStatusModal ? (
          <button
            type="button"
            className={`badge badge-sm mt-1 group min-w-28 cursor-pointer justify-center gap-1 transition-colors hover:border-primary hover:bg-primary hover:text-primary-content ${getStatusBadgeClass(sale.status)}`}
            title="Actualizar estado de venta"
            aria-label={`Actualizar estado de venta: ${sale.status ?? "CONFIRMADA"}`}
            onClick={props.onOpenStatusModal}
          >
            <span className="group-hover:hidden">{sale.status ?? "CONFIRMADA"}</span>
            <span className="hidden items-center gap-1 group-hover:inline-flex">
              <ArrowPathIcon className="size-3" />
              Actualizar
            </span>
          </button>
        ) : (
          <div className={`badge badge-sm mt-1 ${getStatusBadgeClass(sale.status)}`}>{sale.status ?? "CONFIRMADA"}</div>
        )}
      </td>
      {props.canSeeMargin && (
        <td className="align-top">
          <SaleMarginCell profit={sale.profit} canSeeMargin={props.canSeeMargin} />
        </td>
      )}
      <td className="align-top">
        <span className="badge badge-outline">{origin}</span>
      </td>
      <td className="align-top">
        <SaleActionsCell
          sale={sale}
          canCancel={props.canCancel}
          canEdit={props.canEdit}
          canEditConfirmed={props.canEditConfirmed}
          onReceipt={props.onReceipt}
          isReceiptLoading={props.isReceiptLoading}
          onTransport={props.onTransport}
          onCancel={props.onCancel}
        />
      </td>
    </tr>
  )
}
