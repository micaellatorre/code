"use client"

import SalesTableRow from "./SalesTableRow"
import type { SerializedSale, UserSearchResult } from "./types"

type SalesTableProps = {
  sales: SerializedSale[]
  isAdmin: boolean
  canSeeMargin: boolean
  canCancel: boolean
  canEdit: boolean
  canEditConfirmed: boolean
  onReceipt: (sale: SerializedSale) => void
  onTransport: (sale: SerializedSale) => void
  onCancel: (sale: SerializedSale) => void
  sellerEditor: {
    editingSellerId: string | null
    isSearchingUsers: boolean
    isSavingSeller: boolean
    userSearchQuery: string
    userSearchResults: UserSearchResult[]
    editorRef: React.RefObject<HTMLDivElement>
    onOpen: (sale: SerializedSale) => void
    onClose: () => void
    onUserSearchQueryChange: (value: string) => void
    onSelectUser: (saleId: string, user: UserSearchResult) => void
  }
}

export default function SalesTable(props: SalesTableProps) {
  const emptyColSpan = props.canSeeMargin ? 8 : 7

  return (
    <div className="overflow-x-auto rounded-lg border border-base-300 bg-base-100">
      <table className="table table-sm w-full table-pin-rows">
        <thead>
          <tr>
            <th>Fecha</th>
            <th>Vendedor</th>
            <th>Items List</th>
            <th>Cliente</th>
            <th>Importe Venta</th>
            {props.canSeeMargin && <th>Margen</th>}
            <th>Origen</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {props.sales.map((sale) => (
            <SalesTableRow
              key={sale.id}
              sale={sale}
              isAdmin={props.isAdmin}
              canSeeMargin={props.canSeeMargin}
              canCancel={props.canCancel}
              canEdit={props.canEdit}
              canEditConfirmed={props.canEditConfirmed}
              onReceipt={() => props.onReceipt(sale)}
              onTransport={() => props.onTransport(sale)}
              onCancel={() => props.onCancel(sale)}
              sellerProps={{
                isEditing: props.sellerEditor.editingSellerId === sale.id,
                isSearchingUsers: props.sellerEditor.isSearchingUsers,
                isSavingSeller: props.sellerEditor.isSavingSeller,
                userSearchQuery: props.sellerEditor.userSearchQuery,
                userSearchResults: props.sellerEditor.userSearchResults,
                editorRef: props.sellerEditor.editorRef,
                onOpen: () => props.sellerEditor.onOpen(sale),
                onClose: props.sellerEditor.onClose,
                onUserSearchQueryChange: props.sellerEditor.onUserSearchQueryChange,
                onSelectUser: (user) => props.sellerEditor.onSelectUser(sale.id, user),
              }}
            />
          ))}
          {!props.sales.length ? (
            <tr>
              <td colSpan={emptyColSpan} className="py-10 text-center text-base-content/60">
                No se encontraron ventas.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  )
}
