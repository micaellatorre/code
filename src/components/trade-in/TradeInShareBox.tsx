"use client"

import { useMemo, useState } from "react"
import { buildTradeInShareText } from "@/lib/trade-in/calculateTradeIn"
import type { InterestedProductDraft, TradeInDeviceDraft } from "./types"

const LEGAL_TEXT = "Esta cotizacion es informativa y esta sujeta a revision tecnica presencial del equipo entregado, disponibilidad de stock y cotizacion vigente al momento de concretar la operacion."

export default function TradeInShareBox({
  devices,
  interestedProducts,
  selectedProductId,
  onBack,
}: {
  devices: TradeInDeviceDraft[]
  interestedProducts: InterestedProductDraft[]
  selectedProductId: string | null
  onBack: () => void
}) {
  const [copied, setCopied] = useState(false)
  const text = useMemo(() => buildTradeInShareText({ devices, interestedProducts, selectedProductId }), [devices, interestedProducts, selectedProductId])

  const copy = async () => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1600)
  }

  return (
    <section className="rounded-lg border border-base-300 bg-base-100 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold">Texto para compartir</h2>
          <p className="text-sm text-base-content/70">Listo para enviar al cliente.</p>
        </div>
        <div className="flex gap-2">
          <button type="button" className="btn btn-sm" onClick={onBack}>Volver a editar</button>
          <button type="button" className="btn btn-primary btn-sm" onClick={copy}>{copied ? "Copiado" : "Copiar texto"}</button>
        </div>
      </div>
      <pre className="mt-4 max-h-96 overflow-auto whitespace-pre-wrap rounded-lg border border-base-300 bg-base-200 p-3 text-sm">{text}</pre>
      <p className="mt-3 text-xs text-base-content/60">{LEGAL_TEXT}</p>
    </section>
  )
}
