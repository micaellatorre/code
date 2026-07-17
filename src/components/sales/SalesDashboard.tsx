"use client"

import ExportSalesModal from "./ExportSalesModal"
import ReceiptModal from "./ReceiptModal"
import SalesFilters from "./SalesFilters"
import SalesHeader from "./SalesHeader"
import SalesKpis from "./SalesKpis"
import SalesTable from "./SalesTable"
import { useSalesList } from "./useSalesList"
import type { SerializedSale } from "./types"

function TransportModal({ sale, onClose }: { sale: SerializedSale | null; onClose: () => void }) {
  if (!sale) return null
  const buyer = sale.buyer ? `${sale.buyer.name} ${sale.buyer.surname ?? ""}`.trim() : sale.customerName || "Consumidor Final"
  return (
    <dialog className="modal modal-open">
      <div className="modal-box max-w-xl rounded-lg">
        <h2 className="text-xl font-semibold">Transporte / entrega</h2>
        <p className="mt-2 text-sm text-base-content/70">Registro operativo para coordinar retiro, envio o entrega de la venta.</p>
        <div className="mt-4 grid gap-3">
          <div className="rounded-lg border border-base-300 p-3">
            <p className="font-medium">{buyer}</p>
            <p className="text-sm text-base-content/60">{sale.items.map((item) => item.product.modelName).join(" - ")}</p>
          </div>
          <input className="input input-bordered" placeholder="Transporte / cadete / retiro en local" />
          <input className="input input-bordered" placeholder="Direccion o punto de entrega" />
          <textarea className="textarea textarea-bordered" placeholder="Notas de entrega, horarios, contacto alternativo" />
        </div>
        <div className="modal-action">
          <button type="button" className="btn btn-primary" onClick={onClose}>Guardar nota local</button>
        </div>
      </div>
    </dialog>
  )
}

export default function SalesDashboard({ initial }: { initial: SerializedSale[] }) {
  const list = useSalesList(initial)

  return (
    <div className="space-y-4">
      <SalesHeader canCreate={list.canCreate} onExport={() => list.setIsExportOpen(true)} />
      {list.isAdmin || list.isSeller ? <SalesKpis kpis={list.kpis} isAdmin={list.isAdmin} /> : null}
      <SalesFilters
        searchQuery={list.searchQuery}
        setSearchQuery={list.setSearchQuery}
        originFilter={list.originFilter}
        setOriginFilter={list.setOriginFilter}
        statusFilter={list.statusFilter}
        setStatusFilter={list.setStatusFilter}
        dateFrom={list.dateFrom}
        setDateFrom={list.setDateFrom}
        dateTo={list.dateTo}
        setDateTo={list.setDateTo}
        count={list.filteredSales.length}
        onExport={() => list.setIsExportOpen(true)}
      />
      <div className="flex items-center justify-between">
        <span className="whitespace-nowrap text-sm text-base-content/60">{list.filteredSales.length} registros</span>
      </div>
      {list.receiptError ? (
        <div className="alert alert-error py-2 text-sm">
          <span>{list.receiptError}</span>
        </div>
      ) : null}
      <SalesTable
        sales={list.filteredSales}
        isAdmin={list.isAdmin}
        canSeeMargin={list.canSeeMargin}
        canCancel={list.canCancel}
        canEdit={list.canEdit}
        canEditConfirmed={list.canEditConfirmed}
        onReceipt={list.openReceipt}
        receiptLoadingSaleId={list.receiptLoadingSaleId}
        onTransport={list.setTransportSale}
        onCancel={list.cancelSale}
        sellerEditor={list.sellerEditor}
        branchEditor={list.branchEditor}
      />
      <ExportSalesModal open={list.isExportOpen} onClose={() => list.setIsExportOpen(false)} sales={list.filteredSales} canSeeMargin={list.canSeeMargin} />
      <ReceiptModal preview={list.receiptPreview} onClose={() => list.setReceiptPreview(null)} />
      <TransportModal sale={list.transportSale} onClose={() => list.setTransportSale(null)} />
    </div>
  )
}
