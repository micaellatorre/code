"use client"

import ExportSalesModal from "./ExportSalesModal"
import SalesFilters from "./SalesFilters"
import SalesHeader from "./SalesHeader"
import SalesKpis from "./SalesKpis"
import SalesTable from "./SalesTable"
import { useSalesList } from "./useSalesList"
import type { SerializedSale } from "./types"
import { formatSaleDate, formatUsd, getSaleOrigin } from "./salesUtils"

function ReceiptModal({ sale, onClose }: { sale: SerializedSale | null; onClose: () => void }) {
  if (!sale) return null
  const currentSale = sale
  const buyer = currentSale.buyer ? `${currentSale.buyer.name} ${currentSale.buyer.surname ?? ""}`.trim() : currentSale.customerName || "Consumidor Final"
  function printReceipt() {
    const html = `
      <html><head><title>Recibo ${currentSale.id}</title><style>
      body{font-family:Arial,sans-serif;padding:24px}.row{display:flex;justify-content:space-between;border-bottom:1px solid #ddd;padding:6px 0}
      </style></head><body><h1>Recibo de venta</h1><p>${currentSale.id}</p><p>${formatSaleDate(currentSale.date)}</p><p>Cliente: ${buyer}</p>
      ${currentSale.items.map((item) => `<div class="row"><span>${item.product.modelName} x${item.units}</span><strong>${formatUsd(item.lineTotal)}</strong></div>`).join("")}
      <h2>Total ${formatUsd(currentSale.total)}</h2></body></html>`
    const popup = window.open("", "_blank")
    popup?.document.write(html)
    popup?.document.close()
    popup?.print()
  }
  return (
    <dialog className="modal modal-open">
      <div className="modal-box max-w-2xl rounded-lg">
        <h2 className="text-xl font-semibold">Recibo de venta</h2>
        <div className="mt-4 rounded-lg border border-base-300 p-3">
          <p className="font-medium">{buyer}</p>
          <p className="text-sm text-base-content/60">{formatSaleDate(currentSale.date)} · {getSaleOrigin(currentSale)}</p>
        </div>
        <div className="mt-3 divide-y divide-base-300 rounded-lg border border-base-300">
          {currentSale.items.map((item) => (
            <div key={item.id} className="flex justify-between gap-3 p-3 text-sm">
              <span>{item.product.modelName} x{item.units}</span>
              <span className="font-semibold">{formatUsd(item.lineTotal)}</span>
            </div>
          ))}
          <div className="flex justify-between p-3 font-bold">
            <span>Total</span>
            <span>{formatUsd(currentSale.total)}</span>
          </div>
        </div>
        <div className="modal-action">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cerrar</button>
          <button type="button" className="btn btn-primary" onClick={printReceipt}>Imprimir</button>
        </div>
      </div>
    </dialog>
  )
}

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
            <p className="text-sm text-base-content/60">{sale.items.map((item) => item.product.modelName).join(" · ")}</p>
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
      {list.isAdmin ? <SalesKpis kpis={list.kpis} canSeeMargin={list.canSeeMargin} /> : null}
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
      <div className="flex justify-between items-center">
        <span className="whitespace-nowrap text-sm text-base-content/60">{list.filteredSales.length} registros</span>
      </div>
      <SalesTable
        sales={list.filteredSales}
        isAdmin={list.isAdmin}
        canSeeMargin={list.canSeeMargin}
        canCancel={list.canCancel}
        canEdit={list.canEdit}
        canEditConfirmed={list.canEditConfirmed}
        onReceipt={list.setReceiptSale}
        onTransport={list.setTransportSale}
        onCancel={list.cancelSale}
        sellerEditor={list.sellerEditor}
      />
      <ExportSalesModal open={list.isExportOpen} onClose={() => list.setIsExportOpen(false)} sales={list.filteredSales} canSeeMargin={list.canSeeMargin} />
      <ReceiptModal sale={list.receiptSale} onClose={() => list.setReceiptSale(null)} />
      <TransportModal sale={list.transportSale} onClose={() => list.setTransportSale(null)} />
    </div>
  )
}
