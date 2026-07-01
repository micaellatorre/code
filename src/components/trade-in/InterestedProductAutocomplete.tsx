"use client"

import { useEffect, useState } from "react"
import { formatUsd } from "@/lib/trade-in/calculateTradeIn"
import ImeiDisplay from "@/components/common/ImeiDisplay"
import type { EligibleProductDto } from "./types"
import { parseApiMoney } from "./utils"

export default function InterestedProductAutocomplete({ onAdd }: { onAdd: (product: EligibleProductDto) => void }) {
  const [q, setQ] = useState("")
  const [state, setState] = useState<"EN_STOCK" | "EN_CAMINO">("EN_STOCK")
  const [includeReserved, setIncludeReserved] = useState(false)
  const [products, setProducts] = useState<EligibleProductDto[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    const params = new URLSearchParams({ q, state, includeReserved: String(includeReserved) })
    setLoading(true)
    setError(null)
    fetch(`/api/trade-in/eligible-products?${params.toString()}`, { signal: controller.signal })
      .then(async (res) => {
        if (res.ok) return res.json()
        const data = await res.json().catch(() => null)
        throw new Error(data?.error ?? `Error ${res.status}`)
      })
      .then((data) => setProducts(data.products ?? []))
      .catch((err) => {
        if (!controller.signal.aborted) {
          setProducts([])
          setError(err instanceof Error ? err.message : "No se pudo buscar productos")
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [includeReserved, q, state])

  return (
    <div className="space-y-3">
      <div className="grid gap-3 md:grid-cols-[1fr_180px_auto]">
        <input className="input input-bordered" placeholder="Buscar por modelo, IMEI, color o capacidad..." value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="select select-bordered" value={state} onChange={(e) => setState(e.target.value as "EN_STOCK" | "EN_CAMINO")}>
          <option value="EN_STOCK">EN_STOCK</option>
          <option value="EN_CAMINO">EN_CAMINO</option>
        </select>
        <label className="flex items-center gap-2 text-sm">
          <input className="toggle toggle-sm" type="checkbox" checked={includeReserved} onChange={(e) => setIncludeReserved(e.target.checked)} />
          Reservados
        </label>
      </div>
      <div className="max-h-80 overflow-y-auto rounded-lg border border-base-300">
        {error ? <div className="border-b border-base-300 p-3 text-sm text-error">{error}</div> : null}
        {loading ? <div className="p-4 text-sm">Buscando...</div> : null}
        {!loading && !error && products.length === 0 ? <div className="p-4 text-sm text-base-content/60">Sin resultados. Proba cambiar el estado o activar Reservados.</div> : null}
        {products.map((product) => (
          <button key={product.id} type="button" className="flex w-full items-center justify-between gap-3 border-b border-base-300 p-3 text-left last:border-b-0 hover:bg-base-200" onClick={() => onAdd(product)}>
            <span>
              <span className="block font-medium">{product.modelName} - {product.capacityGB ?? "-"} GB - {product.batteryPct ?? "-"}% - {product.color ?? "Sin color"}</span>
              <span className="flex flex-wrap items-baseline gap-x-1 text-xs text-base-content/60">
                # <ImeiDisplay imei={product.imei} fallback="Sin IMEI" />
                <span>- {product.state}</span>
                {product.senado ? <span className="badge badge-warning badge-xs ml-1">Reservado</span> : null}
              </span>
            </span>
            <span className="shrink-0 font-semibold">{formatUsd(parseApiMoney(product.salePrice))}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
