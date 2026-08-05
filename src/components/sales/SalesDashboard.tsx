"use client"

import { useState } from "react"
import ExportSalesModal from "./ExportSalesModal"
import ReceiptModal from "./ReceiptModal"
import SaleCustomerUpdateModal from "./SaleCustomerUpdateModal"
import SaleStatusUpdateModal from "./SaleStatusUpdateModal"
import SalesFilters from "./SalesFilters"
import SalesHeader from "./SalesHeader"
import SalesKpis from "./SalesKpis"
import SalesTable from "./SalesTable"
import { useSalesList } from "./useSalesList"
import { getProductDisplayModel } from "@/lib/products/display"
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
            <p className="text-sm text-base-content/60">{sale.items.map((item) => getProductDisplayModel(item.product)).join(" - ")}</p>
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
  const [statusModalSale, setStatusModalSale] = useState<SerializedSale | null>(null)
  const [customerModalSale, setCustomerModalSale] = useState<SerializedSale | null>(null)
  const currentStatusModalSale = statusModalSale
    ? list.sales.find((sale) => sale.id === statusModalSale.id) ?? statusModalSale
    : null
  const currentCustomerModalSale = customerModalSale
    ? list.sales.find((sale) => sale.id === customerModalSale.id) ?? customerModalSale
    : null

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
        onOpenStatusModal={setStatusModalSale}
        onOpenCustomerModal={setCustomerModalSale}
        sellerEditor={list.sellerEditor}
        branchEditor={list.branchEditor}
      />
      <ExportSalesModal open={list.isExportOpen} onClose={() => list.setIsExportOpen(false)} sales={list.filteredSales} canSeeMargin={list.canSeeMargin} />
      <ReceiptModal preview={list.receiptPreview} onClose={() => list.setReceiptPreview(null)} />
      <TransportModal sale={list.transportSale} onClose={() => list.setTransportSale(null)} />
      {currentStatusModalSale ? (
        <SaleStatusUpdateModal
          sale={currentStatusModalSale}
          open={Boolean(currentStatusModalSale)}
          canSave={list.isAdmin || currentStatusModalSale.status !== "CONFIRMADA"}
          onClose={() => setStatusModalSale(null)}
          onSaved={list.updateSale}
        />
      ) : null}
      {currentCustomerModalSale ? (
        <SaleCustomerUpdateModal
          sale={currentCustomerModalSale}
          open={Boolean(currentCustomerModalSale)}
          onClose={() => setCustomerModalSale(null)}
          onSaved={list.updateSale}
        />
      ) : null}
    </div>
  )
}
