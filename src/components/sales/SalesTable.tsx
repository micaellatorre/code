"use client"

import SalesTableRow from "./SalesTableRow"
import type { SerializedSale } from "./types"

type SalesTableProps = {
  sales: SerializedSale[]
  canSeeMargin: boolean
  canCancel: boolean
  canEdit: boolean
  canEditConfirmed: boolean
  onReceipt: (sale: SerializedSale) => void
  onTransport: (sale: SerializedSale) => void
  onCancel: (sale: SerializedSale) => void
}

export default function SalesTable(props: SalesTableProps) {
  return (
    <div className="overflow-x-auto rounded-lg border border-base-300 bg-base-100">
      <table className="table table-sm w-full table-pin-rows">
        <thead>
          <tr>
            <th>Fecha</th>
            <th>Items List</th>
            <th>Cliente</th>
            <th>Importe Venta</th>
            <th>Margen</th>
            <th>Origen</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {props.sales.map((sale) => (
            <SalesTableRow
              key={sale.id}
              sale={sale}
              canSeeMargin={props.canSeeMargin}
              canCancel={props.canCancel}
              canEdit={props.canEdit}
              canEditConfirmed={props.canEditConfirmed}
              onReceipt={() => props.onReceipt(sale)}
              onTransport={() => props.onTransport(sale)}
              onCancel={() => props.onCancel(sale)}
            />
          ))}
          {!props.sales.length ? (
            <tr>
              <td colSpan={7} className="py-10 text-center text-base-content/60">
                No se encontraron ventas.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  )
}
