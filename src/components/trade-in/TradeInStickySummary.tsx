"use client"

import { formatTradeInDifference, formatUsd, type TradeInQuoteScenario } from "@/lib/trade-in/calculateTradeIn"

export default function TradeInStickySummary({
  devicesCount,
  optionsCount,
  creditTotal,
  selectedScenario,
  selectedLabel,
  actionLabel,
  onAction,
}: {
  devicesCount: number
  optionsCount: number
  creditTotal: number
  selectedScenario: TradeInQuoteScenario | null
  selectedLabel?: string
  actionLabel: string
  onAction: () => void
}) {
  return (
    <>
      <aside className="hidden rounded-lg border border-base-300 bg-base-100 p-4 shadow-sm lg:sticky lg:top-4 lg:block">
        <h2 className="text-base font-semibold">Resumen Plan Canje</h2>
        <div className="mt-4 space-y-2 text-sm">
          <div className="flex justify-between gap-3"><span>Equipos entregados</span><span className="font-semibold">{devicesCount}</span></div>
          <div className="flex justify-between gap-3"><span>Opciones comparadas</span><span className="font-semibold">{optionsCount}</span></div>
          <div className="flex justify-between gap-3 border-t border-base-300 pt-2"><span>Credito total</span><span className="font-semibold">{formatUsd(creditTotal)}</span></div>
          {selectedScenario ? (
            <>
              <div className="flex justify-between gap-3"><span>Opcion seleccionada</span><span className="max-w-44 text-right font-semibold">{selectedScenario.productLabel}</span></div>
              <div className="flex justify-between gap-3 text-base font-bold"><span>Resultado</span><span>{formatTradeInDifference(selectedScenario.difference).replace(": ", " ")}</span></div>
            </>
          ) : (
            <p className="rounded-md bg-base-200 p-2 text-sm text-base-content/70">{selectedLabel ?? "Selecciona una opcion para continuar"}</p>
          )}
        </div>
        <button type="button" className="btn btn-primary btn-sm mt-4 w-full" onClick={onAction}>{actionLabel}</button>
      </aside>
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-base-300 bg-base-100/95 p-3 shadow-lg backdrop-blur lg:hidden">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
          <div className="min-w-0 text-sm">
            <p className="font-semibold">Credito {formatUsd(creditTotal)}</p>
            <p className="truncate text-xs text-base-content/70">{selectedScenario ? formatTradeInDifference(selectedScenario.difference) : selectedLabel ?? "Seleccion pendiente"}</p>
          </div>
          <button type="button" className="btn btn-primary btn-sm" onClick={onAction}>Ver Cotización</button>
        </div>
      </div>
    </>
  )
}
