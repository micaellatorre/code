"use client"

import { calculateQuoteScenarios, formatTradeInDifference, formatUsd } from "@/lib/trade-in/calculateTradeIn"
import ImeiDisplay from "@/components/common/ImeiDisplay"
import { getProductDisplayCapacity, getProductDisplayColor, getProductDisplayModel } from "@/lib/products/display"
import type { InterestedProductDraft } from "./types"

export default function InterestedProductsList({
  products,
  canEditPrice,
  creditTotal,
  selectedProductId,
  onSelect,
  onRemove,
  onPriceChange,
}: {
  products: InterestedProductDraft[]
  canEditPrice: boolean
  creditTotal: number
  selectedProductId: string | null
  onSelect: (id: string) => void
  onRemove: (id: string) => void
  onPriceChange: (id: string, quotedPrice: number) => void
}) {
  const scenarios = calculateQuoteScenarios(products, creditTotal)

  if (products.length === 0) {
    return <p className="mt-3 text-sm text-base-content/60">Selecciona uno o mas equipos del stock para comparar opciones.</p>
  }

  return (
    <div className="mt-3 grid gap-3 md:grid-cols-2">
      {products.map((product) => {
        const scenario = scenarios.find((item) => item.productId === product.id)
        const selected = selectedProductId === product.id || products.length === 1

        return (
          <div key={product.id} className={`rounded-lg border p-3 ${selected ? "border-primary bg-primary/10" : "border-base-300 bg-base-200/40"}`}>
            <div className="flex items-start justify-between gap-3">
              <label className="flex min-w-0 flex-1 cursor-pointer items-start gap-2">
                <input className="radio radio-primary radio-sm mt-1" type="radio" checked={selected} onChange={() => onSelect(product.id)} />
                <span className="min-w-0">
                  <span className="block font-semibold">{getProductDisplayModel(product)} - {getProductDisplayCapacity(product) ?? "-"}</span>
                  <span className="flex flex-wrap items-baseline gap-x-1 text-xs text-base-content/60">
                    <span>{product.batteryPct ?? "-"}%</span>
                    <span>- {getProductDisplayColor(product) ?? "Sin color"}</span>
                    <span className="inline-flex items-baseline gap-1">
                      - #<ImeiDisplay imei={product.imei} fallback="Sin IMEI" />
                    </span>
                  </span>
                </span>
              </label>
              <button type="button" className="btn btn-xs btn-outline" onClick={() => onRemove(product.id)}>Eliminar</button>
            </div>

            <div className="mt-2 flex gap-1">
              <span className="badge badge-outline badge-xs">{product.state}</span>
              {product.senado ? <span className="badge badge-warning badge-xs">Reservado</span> : null}
              {selected ? <span className="badge badge-primary badge-xs">Seleccionado</span> : null}
            </div>

            <div className="mt-3 space-y-2">
              {canEditPrice ? (
                <label className="form-control">
                  <span className="label-text">Precio cotizado USD</span>
                  <input className="input input-bordered input-sm" type="number" min={0} value={product.quotedPrice} onChange={(e) => onPriceChange(product.id, Number(e.target.value) || 0)} />
                </label>
              ) : (
                <p className="font-semibold">Precio: {formatUsd(product.quotedPrice)}</p>
              )}
              <div className="rounded-md bg-base-100 p-2 text-sm">
                <div className="flex justify-between gap-3"><span>Credito aplicado</span><span>{formatUsd(creditTotal)}</span></div>
                <div className="flex justify-between gap-3 font-semibold"><span>Resultado</span><span>{scenario ? formatTradeInDifference(scenario.difference) : "-"}</span></div>
              </div>
              <button type="button" className={`btn btn-sm w-full ${selected ? "btn-primary" : "btn-outline"}`} onClick={() => onSelect(product.id)}>
                {selected ? "Opcion seleccionada para cotizacion" : "Seleccionar opcion"}
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}
