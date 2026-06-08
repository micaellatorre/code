"use client"

import Link from "next/link"
import { formatUsd } from "@/components/sales/salesUtils"
import type { SaleFormSuccess } from "@/components/sales/types"

export default function SaleSuccessScreen({ success }: { success: SaleFormSuccess }) {
  function printReceipt() {
    const html = `
      <html><head><title>Comprobante ${success.saleId ?? ""}</title><style>
      body{font-family:Arial,sans-serif;padding:24px} .box{border:1px solid #ddd;padding:16px;border-radius:8px}
      </style></head><body><div class="box"><h1>Venta registrada</h1>
      <p>Venta: ${success.saleId ?? "-"}</p><p>Cliente: ${success.customerName}</p>
      <p>Importe: ${formatUsd(success.total)}</p><p>Emitido: ${new Date().toLocaleString("es-AR")}</p></div></body></html>`
    const popup = window.open("", "_blank")
    popup?.document.write(html)
    popup?.document.close()
    popup?.print()
  }

  return (
    <div className="mx-auto max-w-2xl rounded-lg border border-base-300 bg-base-100 p-8 text-center">
      <h1 className="text-2xl font-bold">Venta registrada con exito</h1>
      <p className="mt-2 text-base-content/70">
        Se cargo la venta para {success.customerName} por el importe de {formatUsd(success.total)}.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <Link href="/dashboard/sales" className="btn btn-primary">Ir a Ventas</Link>
        <button type="button" className="btn btn-outline" onClick={printReceipt}>Comprobante</button>
        <Link href="/dashboard/sales/new" className="btn btn-ghost">Otra Venta</Link>
      </div>
    </div>
  )
}
