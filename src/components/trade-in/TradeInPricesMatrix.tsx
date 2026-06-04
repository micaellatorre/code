"use client"

import { useEffect, useMemo, useState } from "react"
import { IPHONE_TRADE_IN_CATALOG } from "@/lib/trade-in/iphoneCatalog"
import type { TradeInBatteryRangeDto, TradeInPriceDto } from "./types"

type HistoricalAverage = {
  modelName: string
  capacityGB: number
  batteryRangeId: string
  averagePrice: number | null
  sampleSize: number
}

type PricePatch = {
  modelName: string
  capacityGB: number
  batteryRangeId: string
  referencePrice: number
}

function priceKey(modelName: string, capacityGB: number, batteryRangeId: string) {
  return `${modelName}|${capacityGB}|${batteryRangeId}`
}

export default function TradeInPricesMatrix({
  ranges,
  prices,
}: {
  ranges: TradeInBatteryRangeDto[]
  prices: TradeInPriceDto[]
  onChange: () => Promise<void>
}) {
  const [localPrices, setLocalPrices] = useState<Map<string, string>>(new Map())
  const [savingKey, setSavingKey] = useState<string | null>(null)
  const [autofillingScope, setAutofillingScope] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [seriesMessages, setSeriesMessages] = useState<Record<string, string>>({})

  useEffect(() => {
    const map = new Map<string, string>()
    prices.forEach((price) => map.set(priceKey(price.modelName, price.capacityGB, price.batteryRangeId), price.referencePrice))
    setLocalPrices(map)
  }, [prices])

  const seriesStats = useMemo(() => {
    const stats = new Map<string, { loaded: number; total: number }>()
    IPHONE_TRADE_IN_CATALOG.forEach((series) => {
      const total = series.models.reduce((acc, model) => acc + model.capacities.length * ranges.length, 0)
      const loaded = series.models.reduce(
        (acc, model) =>
          acc + model.capacities.reduce(
            (count, capacity) =>
              count + ranges.filter((range) => Number(localPrices.get(priceKey(model.modelName, capacity, range.id)) ?? 0) > 0).length,
            0
          ),
        0
      )
      stats.set(series.series, { loaded, total })
    })
    return stats
  }, [localPrices, ranges])

  const persistPrices = async (items: PricePatch[]) => {
    const res = await fetch("/api/trade-in/prices/batch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items }),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => null)
      throw new Error(data?.error ?? "No se pudieron guardar los precios")
    }
    return res.json() as Promise<{ prices: TradeInPriceDto[] }>
  }

  const savePrice = async (modelName: string, capacityGB: number, batteryRangeId: string, referencePrice: string) => {
    const key = priceKey(modelName, capacityGB, batteryRangeId)
    const normalizedValue = String(Number(referencePrice || 0))
    if (String(localPrices.get(key) ?? "0") === normalizedValue) return

    setSavingKey(key)
    setMessage(null)
    try {
      const data = await persistPrices([{ modelName, capacityGB, batteryRangeId, referencePrice: Number(referencePrice || 0) }])
      setLocalPrices((current) => {
        const next = new Map(current)
        data.prices.forEach((price) => next.set(priceKey(price.modelName, price.capacityGB, price.batteryRangeId), price.referencePrice))
        return next
      })
      setMessage("Precio guardado")
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "No se pudo guardar el precio")
    } finally {
      setSavingKey(null)
    }
  }

  const autofill = async (seriesName?: string) => {
    if (!window.confirm("Esto completara celdas vacias usando promedios historicos disponibles. Continuar?")) return

    const scope = seriesName ?? "__all__"
    setAutofillingScope(scope)
    setMessage(seriesName ? null : "Autocompletando todas las series...")
    if (seriesName) setSeriesMessages((current) => ({ ...current, [seriesName]: "Autocompletando..." }))

    try {
      const res = await fetch("/api/trade-in/historical-averages", { cache: "no-store" })
      if (!res.ok) throw new Error("No se pudieron cargar promedios historicos")

      const data = await res.json() as { averages?: HistoricalAverage[] }
      const averages = data.averages ?? []
      const targetModels = new Set(
        IPHONE_TRADE_IN_CATALOG
          .filter((series) => !seriesName || series.series === seriesName)
          .flatMap((series) => series.models.map((model) => model.modelName))
      )

      const items = averages.flatMap((average) => {
        const key = priceKey(average.modelName, average.capacityGB, average.batteryRangeId)
        const currentValue = Number(localPrices.get(key) ?? 0)
        if (!targetModels.has(average.modelName) || currentValue > 0 || !average.averagePrice) return []
        return [{
          modelName: average.modelName,
          capacityGB: average.capacityGB,
          batteryRangeId: average.batteryRangeId,
          referencePrice: average.averagePrice,
        }]
      })

      if (!items.length) {
        const text = "Sin datos historicos disponibles"
        if (seriesName) setSeriesMessages((current) => ({ ...current, [seriesName]: text }))
        else setMessage(text)
        return
      }

      const persisted = await persistPrices(items)
      setLocalPrices((current) => {
        const next = new Map(current)
        persisted.prices.forEach((price) => next.set(priceKey(price.modelName, price.capacityGB, price.batteryRangeId), price.referencePrice))
        return next
      })

      const text = `Celdas completadas: ${persisted.prices.length}`
      if (seriesName) setSeriesMessages((current) => ({ ...current, [seriesName]: text }))
      else setMessage(text)
    } catch (err) {
      const text = err instanceof Error ? err.message : "No se pudo autocompletar"
      if (seriesName) setSeriesMessages((current) => ({ ...current, [seriesName]: text }))
      else setMessage(text)
    } finally {
      setAutofillingScope(null)
    }
  }

  const isAutofillingAll = autofillingScope === "__all__"

  return (
    <section className="rounded-lg border border-base-300 bg-base-100 p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Precios sugeridos</h2>
          {message ? <span className="text-sm text-base-content/70">{message}</span> : null}
        </div>
        <button type="button" className="btn btn-outline btn-sm" onClick={() => void autofill()} disabled={Boolean(autofillingScope)}>
          {isAutofillingAll ? <span className="loading loading-spinner loading-xs" /> : null}
          Autocompletar con promedio historico
        </button>
      </div>
      <div className="space-y-4">
        {IPHONE_TRADE_IN_CATALOG.map((series) => {
          const stats = seriesStats.get(series.series) ?? { loaded: 0, total: 0 }
          const isAutofillingSeries = autofillingScope === series.series
          const disabledSeries = Boolean(autofillingScope)

          return (
            <details key={series.series} className="collapse collapse-arrow border border-base-300 bg-base-200/40" open={series.series.includes("15") || series.series.includes("16")}>
              <summary className="collapse-title flex items-center justify-between gap-3 text-base font-semibold">
                <span>{series.series}</span>
                <span className="flex items-center gap-2 text-xs font-normal">
                  {seriesMessages[series.series] ? <span className="text-base-content/60">{seriesMessages[series.series]}</span> : null}
                  <span>Valores cargados: {stats.loaded}/{stats.total}</span>
                  <button
                    type="button"
                    className="btn btn-xs btn-outline"
                    onClick={(e) => { e.preventDefault(); void autofill(series.series) }}
                    disabled={disabledSeries}
                  >
                    {isAutofillingSeries ? <span className="loading loading-spinner loading-xs" /> : null}
                    Autocompletar serie
                  </button>
                </span>
              </summary>
              <div className={`collapse-content overflow-x-auto ${isAutofillingSeries ? "opacity-60" : ""}`}>
                <table className="table table-sm">
                  <thead>
                    <tr>
                      <th>Modelo</th>
                      <th>Capacidad</th>
                      {ranges.map((range) => <th key={range.id}>{range.label}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {series.models.flatMap((model) =>
                      model.capacities.map((capacity) => (
                        <tr key={`${model.modelName}-${capacity}`}>
                          <td className="min-w-40">{model.modelName}</td>
                          <td>{capacity} GB</td>
                          {ranges.map((range) => {
                            const key = priceKey(model.modelName, capacity, range.id)
                            return (
                              <td key={range.id}>
                                <input
                                  key={`${key}-${localPrices.get(key) ?? "0"}`}
                                  className="input input-bordered input-sm w-28"
                                  type="number"
                                  min={0}
                                  defaultValue={localPrices.get(key) ?? "0"}
                                  disabled={savingKey === key || disabledSeries}
                                  onBlur={(e) => void savePrice(model.modelName, capacity, range.id, e.target.value)}
                                />
                              </td>
                            )
                          })}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </details>
          )
        })}
      </div>
    </section>
  )
}
