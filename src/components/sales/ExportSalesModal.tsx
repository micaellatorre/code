"use client"

import { useState } from "react"
import { formatSaleDate, formatUsd, getSaleOrigin } from "./salesUtils"
import { getProductDisplayModel } from "@/lib/products/display"
import type { SerializedSale } from "./types"

const columnOptions = ["Fecha", "Cliente", "Items", "Importe", "Margen", "Origen", "Vendedor", "Estado"]

export default function ExportSalesModal({
  open,
  onClose,
  sales,
  canSeeMargin,
}: {
  open: boolean
  onClose: () => void
  sales: SerializedSale[]
  canSeeMargin: boolean
}) {
  const [format, setFormat] = useState<"Excel" | "PDF">("Excel")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [columns, setColumns] = useState(columnOptions)

  if (!open) return null

  function toggleColumn(column: string) {
    setColumns((prev) => (prev.includes(column) ? prev.filter((item) => item !== column) : [...prev, column]))
  }

  function getCell(sale: SerializedSale, column: string) {
    const buyer = sale.buyer ? `${sale.buyer.name} ${sale.buyer.surname ?? ""}`.trim() : sale.customerName || "Consumidor Final"
    const items = sale.items.map((item) => `${getProductDisplayModel(item.product)} x${item.units}`).join(" | ")
    const values: Record<string, string> = {
      Fecha: formatSaleDate(sale.date),
      Cliente: buyer,
      Items: items,
      Importe: formatUsd(sale.total),
      Margen: canSeeMargin ? formatUsd(sale.profit) : "Restringido",
      Origen: getSaleOrigin(sale),
      Vendedor: sale.createdBy,
      Estado: sale.status ?? "CONFIRMADA",
    }
    return values[column] ?? ""
  }

  function download(filename: string, content: string, type: string) {
    const blob = new Blob([content], { type })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = filename
    link.click()
    URL.revokeObjectURL(url)
  }

  function filteredByDate() {
    return sales.filter((sale) => {
      if (!sale.date) return false
      const day = sale.date.slice(0, 10)
      return (!dateFrom || day >= dateFrom) && (!dateTo || day <= dateTo)
    })
  }

  function handleExport() {
    const rows = filteredByDate()
    if (format === "PDF") {
      const html = `
        <html><head><title>Exportar ventas</title><style>
        body{font-family:Arial,sans-serif;padding:24px} table{width:100%;border-collapse:collapse} th,td{border:1px solid #ddd;padding:6px;font-size:12px;text-align:left} th{background:#f3f4f6}
        </style></head><body>
        <h1>Ventas</h1><p>Emitido: ${new Date().toLocaleString("es-AR")}</p>
        <table><thead><tr>${columns.map((column) => `<th>${column}</th>`).join("")}</tr></thead>
        <tbody>${rows.map((sale) => `<tr>${columns.map((column) => `<td>${getCell(sale, column)}</td>`).join("")}</tr>`).join("")}</tbody></table>
        </body></html>`
      const popup = window.open("", "_blank")
      popup?.document.write(html)
      popup?.document.close()
      popup?.print()
      onClose()
      return
    }

    const csv = [
      columns.join(","),
      ...rows.map((sale) => columns.map((column) => `"${getCell(sale, column).replace(/"/g, '""')}"`).join(",")),
    ].join("\n")
    download(`ventas-${new Date().toISOString().slice(0, 10)}.csv`, csv, "text/csv;charset=utf-8")
    onClose()
  }

  return (
    <dialog className="modal modal-open">
      <div className="modal-box max-w-2xl rounded-lg">
        <h2 className="text-xl font-semibold">Exportar ventas</h2>
        <p className="mt-2 text-sm text-base-content/70">Selecciona formato, periodo y columnas a incluir.</p>
        <div className="mt-4 grid gap-4">
          <div className="join">
            {(["Excel", "PDF"] as const).map((item) => (
              <button key={item} type="button" className={`btn join-item btn-sm ${format === item ? "btn-primary" : "btn-outline"}`} onClick={() => setFormat(item)}>
                {item}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <input type="date" className="input input-bordered" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
            <input type="date" className="input input-bordered" value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {columnOptions.map((column) => (
              <label key={column} className="flex items-center gap-2 rounded-md border border-base-300 p-2">
                <input type="checkbox" className="checkbox checkbox-sm" checked={columns.includes(column)} onChange={() => toggleColumn(column)} />
                <span className="text-sm">{column}</span>
              </label>
            ))}
          </div>
          <div className="alert alert-info py-3 text-sm">
            La exportacion sera generada por el usuario actual con fecha y hora de emision.
          </div>
        </div>
        <div className="modal-action">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cerrar</button>
          <button type="button" className="btn btn-primary" onClick={handleExport}>Exportar</button>
        </div>
      </div>
    </dialog>
  )
}
