"use client"

import { formatSaleDate, getSaleOrigin, getStatusBadgeClass, isTodayInArgentina } from "./salesUtils"
import SaleActionsCell from "./SaleActionsCell"
import SaleAmountCell from "./SaleAmountCell"
import SaleBuyerCell from "./SaleBuyerCell"
import SaleItemsCell from "./SaleItemsCell"
import SaleMarginCell from "./SaleMarginCell"
import type { SerializedSale } from "./types"

type SalesTableRowProps = {
  sale: SerializedSale
  canSeeMargin: boolean
  canCancel: boolean
  canEdit: boolean
  canEditConfirmed: boolean
  onReceipt: () => void
  onTransport: () => void
  onCancel: () => void
}

export default function SalesTableRow(props: SalesTableRowProps) {
  const { sale } = props
  const origin = getSaleOrigin(sale)

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
        <SaleItemsCell items={sale.items} />
      </td>
      <td className="align-top">
        <SaleBuyerCell sale={sale} />
      </td>
      <td className="align-top">
        <SaleAmountCell total={sale.total} />
        <div className={`badge badge-xs mt-1 ${getStatusBadgeClass(sale.status)}`}>{sale.status ?? "CONFIRMADA"}</div>
      </td>
      <td className="align-top">
        <SaleMarginCell profit={sale.profit} canSeeMargin={props.canSeeMargin} />
      </td>
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
          onTransport={props.onTransport}
          onCancel={props.onCancel}
        />
      </td>
    </tr>
  )
}
