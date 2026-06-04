"use client"

import { formatTradeInDifference, formatUsd, type TradeInQuoteScenario } from "@/lib/trade-in/calculateTradeIn"
import type { TradeInDeviceDraft } from "./types"

export default function TradeInQuoteSummary({
  devices,
  creditTotal,
  selectedScenario,
  scenarios,
}: {
  devices: TradeInDeviceDraft[]
  creditTotal: number
  selectedScenario: TradeInQuoteScenario | null
  scenarios: TradeInQuoteScenario[]
}) {
  return (
    <section className="space-y-4">
      {!selectedScenario ? (
        <div className="alert alert-warning py-2 text-sm">Selecciona una opcion de compra para continuar con la cotizacion.</div>
      ) : null}

      <div className="rounded-lg border border-base-300 bg-base-100 p-4">
        <h2 className="text-lg font-semibold">Cotizacion final</h2>
        <div className="mt-3 space-y-3 text-sm">
          <div>
            <h3 className="font-semibold">Credito por equipos entregados</h3>
            {devices.length ? (
              <ul className="mt-2 space-y-1">
                {devices.map((device) => (
                  <li key={device.id} className="flex justify-between gap-3">
                    <span>{device.modelName} {device.capacityGB} GB</span>
                    <span>{formatUsd(device.finalValue)}</span>
                  </li>
                ))}
              </ul>
            ) : <p className="mt-2 text-base-content/60">Sin equipos entregados.</p>}
            <div className="mt-2 flex justify-between border-t border-base-300 pt-2 font-bold">
              <span>Total credito</span>
              <span>{formatUsd(creditTotal)}</span>
            </div>
          </div>

          {selectedScenario ? (
            <>
              <div>
                <h3 className="font-semibold">Equipo seleccionado</h3>
                <div className="mt-2 flex justify-between gap-3">
                  <span>{selectedScenario.productLabel}</span>
                  <span>{formatUsd(selectedScenario.productPrice)}</span>
                </div>
              </div>
              <div className={`alert py-2 text-sm ${selectedScenario.difference > 0 ? "alert-info" : selectedScenario.difference < 0 ? "alert-warning" : "alert-success"}`}>
                {formatTradeInDifference(selectedScenario.difference)}
                {selectedScenario.difference < 0 ? ". No implica devolucion automatica." : null}
              </div>
            </>
          ) : null}

          {scenarios.length > 1 ? (
            <details className="rounded-md bg-base-200 p-3">
              <summary className="cursor-pointer font-medium">Otras opciones comparadas</summary>
              <ul className="mt-2 space-y-1 text-xs">
                {scenarios.filter((scenario) => scenario.productId !== selectedScenario?.productId).map((scenario) => (
                  <li key={scenario.productId} className="flex justify-between gap-3">
                    <span>{scenario.productLabel}</span>
                    <span>{formatTradeInDifference(scenario.difference)}</span>
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
        </div>
      </div>
    </section>
  )
}
