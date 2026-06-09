"use client"

import { useState } from "react"
import { formatAppointmentDate, formatMoney, getAppointmentDepositTotal, getAppointmentReservedValue } from "./appointmentUtils"
import type { SerializedAppointment } from "./types"

type ExportAppointmentsModalProps = {
  open: boolean
  onClose: () => void
  appointments: SerializedAppointment[]
}

const columnOptions = [
  "Fecha",
  "Cliente",
  "Contacto",
  "Items",
  "Precio pactado",
  "Seña",
  "Saldo",
  "Estado",
  "Resultado",
  "Creada por",
]

export default function ExportAppointmentsModal({ open, onClose, appointments }: ExportAppointmentsModalProps) {
  const [format, setFormat] = useState<"Excel" | "PDF">("Excel")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [columns, setColumns] = useState<string[]>(columnOptions)

  if (!open) return null

  function toggleColumn(column: string) {
    setColumns((prev) => (prev.includes(column) ? prev.filter((item) => item !== column) : [...prev, column]))
  }

  function getCell(appointment: SerializedAppointment, column: string) {
    const total = getAppointmentReservedValue(appointment)
    const deposit = getAppointmentDepositTotal(appointment)
    const values: Record<string, string> = {
      Fecha: formatAppointmentDate(appointment.scheduledAt),
      Cliente: appointment.buyer?.name ?? "Sin cliente",
      Contacto: [appointment.buyer?.phone, appointment.buyer?.instagram].filter(Boolean).join(" / "),
      Items: appointment.interests.map((interest) => interest.product.modelName).join(" | "),
      "Precio pactado": formatMoney(total),
      Seña: formatMoney(deposit),
      Saldo: formatMoney(total - deposit),
      Estado: appointment.status,
      Resultado: appointment.outcome,
      "Creada por": appointment.createdBy,
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
    return appointments.filter((appointment) => {
      const day = appointment.scheduledAt.slice(0, 10)
      return (!dateFrom || day >= dateFrom) && (!dateTo || day <= dateTo)
    })
  }

  function handleExport() {
    const rows = filteredByDate()
    if (format === "PDF") {
      const html = `
        <html><head><title>Exportar reservas</title><style>
        body{font-family:Arial,sans-serif;padding:24px} table{width:100%;border-collapse:collapse} th,td{border:1px solid #ddd;padding:6px;font-size:12px;text-align:left} th{background:#f3f4f6}
        </style></head><body><h1>Citas</h1><p>Emitido: ${new Date().toLocaleString("es-AR")}</p>
        <table><thead><tr>${columns.map((column) => `<th>${column}</th>`).join("")}</tr></thead>
        <tbody>${rows.map((appointment) => `<tr>${columns.map((column) => `<td>${getCell(appointment, column)}</td>`).join("")}</tr>`).join("")}</tbody></table>
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
      ...rows.map((appointment) => columns.map((column) => `"${getCell(appointment, column).replace(/"/g, '""')}"`).join(",")),
    ].join("\n")
    download(`reservas-${new Date().toISOString().slice(0, 10)}.csv`, csv, "text/csv;charset=utf-8")
    onClose()
  }

  return (
    <dialog className="modal modal-open">
      <div className="modal-box max-w-2xl rounded-lg">
        <h2 className="text-xl font-semibold">Exportar reservas</h2>
        <p className="mt-2 text-sm text-base-content/70">Selecciona el formato, periodo y columnas a incluir.</p>

        <div className="mt-4 grid gap-4">
          <div className="form-control">
            <span className="label-text mb-2">Formato</span>
            <div className="join">
              {(["Excel", "PDF"] as const).map((item) => (
                <button
                  key={item}
                  type="button"
                  className={`btn join-item btn-sm ${format === item ? "btn-primary" : "btn-outline"}`}
                  onClick={() => setFormat(item)}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="form-control">
              <span className="label-text mb-1">Desde</span>
              <input type="date" className="input input-bordered" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
            </label>
            <label className="form-control">
              <span className="label-text mb-1">Hasta</span>
              <input type="date" className="input input-bordered" value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
            </label>
          </div>

          <div>
            <p className="label-text mb-2">Columnas a incluir</p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {columnOptions.map((column) => (
                <label key={column} className="flex items-center gap-2 rounded-md border border-base-300 p-2">
                  <input
                    type="checkbox"
                    className="checkbox checkbox-sm"
                    checked={columns.includes(column)}
                    onChange={() => toggleColumn(column)}
                  />
                  <span className="text-sm">{column}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="alert alert-info py-3 text-sm">
            La exportacion sera generada por el usuario actual con fecha y hora de emision.
          </div>
        </div>

        <div className="modal-action">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cerrar
          </button>
          <button type="button" className="btn btn-primary" onClick={handleExport}>
            Exportar
          </button>
        </div>
      </div>
    </dialog>
  )
}
