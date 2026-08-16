"use client"

import { useEffect, useMemo, useState } from "react"

type QuoteMethod = "EFECTIVO_USD" | "EFECTIVO_PESOS" | "TRANSFERENCIA_ARS" | "USDT" | "BNA_CUOTAS"

type DraftPayment = {
  id: string
  method: QuoteMethod
  amount: string
  useRemaining: boolean
  installments: number
}

type PricingLine = {
  method: QuoteMethod
  currency: "ARS" | "USD" | "USDT"
  amount: string
  coveredUsd: string
  amountUsd: string | null
  exchangeRate: string | null
  surchargePct: string
  surchargeAmount: string
  installments: number | null
  installmentAmount: string | null
  customerRebatePct: string | null
  customerRebateAmount: string | null
}

type QuotePayload = {
  baseTotalUsd: string
  exchangeRate: { rate: string; source: string; fetchedAt: string }
  settings: {
    transferFeeEnabled: boolean
    transferFeeRatePct: string
    bnaInstallmentsEnabled: boolean
    bnaMarkupRatePct: string
    bnaDefaultInstallments: number
    bnaCustomerRebatePct: string
    bnaCustomerRebateCapArs: string
  }
  quickQuotes: PricingLine[]
  payments: PricingLine[]
  coveredUsd: string
  remainingUsd: string
}

const methodOptions: Array<{ value: QuoteMethod; label: string }> = [
  { value: "EFECTIVO_USD", label: "Efectivo USD" },
  { value: "EFECTIVO_PESOS", label: "Efectivo ARS" },
  { value: "TRANSFERENCIA_ARS", label: "Transferencia ARS" },
  { value: "USDT", label: "USDT" },
  { value: "BNA_CUOTAS", label: "Cuotas BNA" },
]

function formatNative(line: PricingLine) {
  const value = Number(line.amount)
  if (line.currency === "ARS") return `$ ${new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 }).format(value)}`
  if (line.currency === "USDT") return `USDT ${new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 }).format(value)}`
  return `USD ${new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 }).format(value)}`
}

function labelFor(method: QuoteMethod) {
  return methodOptions.find((option) => option.value === method)?.label ?? method
}

function formatArs(value: string | number | null | undefined) {
  return `$ ${new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 }).format(Number(value ?? 0))}`
}

function paymentId() {
  return `quote-${crypto.randomUUID()}`
}

export default function SalesQuoteCalculator() {
  const [baseUsd, setBaseUsd] = useState("1000")
  const [payments, setPayments] = useState<DraftPayment[]>([])
  const [quote, setQuote] = useState<QuotePayload | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const requestBody = useMemo(() => ({
    baseTotalUsd: baseUsd,
    payments: payments.map((payment) => ({
      method: payment.method,
      amount: payment.useRemaining ? undefined : payment.amount,
      useRemaining: payment.useRemaining,
      installments: payment.method === "BNA_CUOTAS" ? payment.installments : undefined,
    })),
  }), [baseUsd, payments])

  useEffect(() => {
    const parsed = Number(baseUsd)
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setQuote(null)
      return
    }

    const controller = new AbortController()
    const timer = window.setTimeout(async () => {
      setLoading(true)
      setError(null)
      try {
        const response = await fetch("/api/sales/quote", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestBody),
          signal: controller.signal,
        })
        const body = await response.json().catch(() => null)
        if (!response.ok) throw new Error(body?.error ?? "No se pudo calcular la cotizacion")
        setQuote(body as QuotePayload)
      } catch (loadError) {
        if (loadError instanceof DOMException && loadError.name === "AbortError") return
        setError(loadError instanceof Error ? loadError.message : "No se pudo calcular la cotizacion")
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }, 250)

    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [baseUsd, requestBody])

  function addPayment() {
    setPayments((current) => [
      ...current,
      {
        id: paymentId(),
        method: "EFECTIVO_PESOS",
        amount: "",
        useRemaining: false,
        installments: quote?.settings.bnaDefaultInstallments ?? 12,
      },
    ])
  }

  function patchPayment(id: string, patch: Partial<DraftPayment>) {
    setPayments((current) => current.map((payment) => payment.id === id ? { ...payment, ...patch } : payment))
  }

  function removePayment(id: string) {
    setPayments((current) => current.filter((payment) => payment.id !== id))
  }

  return (
    <div className="space-y-5">
      <section className="rounded-xl border border-base-300 bg-base-100 p-5 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-2xl font-bold">Cotizador</h1>
            <p className="mt-1 text-sm text-base-content/60">Simulacion comercial. No guarda ventas, pagos ni movimientos de Caja.</p>
          </div>
          <label className="form-control w-full md:w-64">
            <span className="label-text font-medium">Precio base USD</span>
            <input
              className="input input-bordered text-lg font-semibold"
              inputMode="decimal"
              value={baseUsd}
              onChange={(event) => setBaseUsd(event.target.value)}
              placeholder="1000"
            />
          </label>
        </div>

        {quote ? (
          <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
            <span className="badge badge-outline">Blue venta: $ {Number(quote.exchangeRate.rate).toLocaleString("es-AR")}</span>
            <span className="text-base-content/50">Actualizado {new Date(quote.exchangeRate.fetchedAt).toLocaleString("es-AR")}</span>
            {loading ? <span className="loading loading-spinner loading-xs" /> : null}
          </div>
        ) : null}
        {error ? <div className="alert alert-error mt-4 py-3 text-sm">{error}</div> : null}
      </section>

      {quote ? (
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {quote.quickQuotes.map((line) => (
            <article key={line.method} className="rounded-xl border border-base-300 bg-base-100 p-4">
              <p className="text-sm font-medium text-base-content/70">{labelFor(line.method)}</p>
              <p className="mt-2 text-xl font-bold">{formatNative(line)}</p>
              {line.method === "TRANSFERENCIA_ARS" && Number(line.surchargePct) > 0 ? (
                <p className="mt-1 text-xs text-base-content/50">Incluye recargo por transferencia.</p>
              ) : null}
              {line.installments && line.installmentAmount ? (
                <p className="mt-2 text-sm font-semibold">BNA · {line.installments} cuotas de {formatArs(line.installmentAmount)}</p>
              ) : null}
              {line.customerRebateAmount ? (
                <p className="mt-1 text-xs text-base-content/60">Reintegro estimado cliente: {formatArs(line.customerRebateAmount)}</p>
              ) : null}
            </article>
          ))}
        </section>
      ) : null}

      <section className="rounded-xl border border-base-300 bg-base-100 p-5 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold">Pago mixto</h2>
            <p className="text-sm text-base-content/60">Cada renglon cancela una parte del precio base en USD.</p>
          </div>
          <button type="button" className="btn btn-primary btn-sm" onClick={addPayment}>Agregar medio</button>
        </div>

        <div className="mt-4 space-y-3">
          {payments.length === 0 ? (
            <div className="rounded-lg border border-dashed border-base-300 p-6 text-center text-sm text-base-content/50">Agrega medios para simular una combinacion.</div>
          ) : payments.map((payment, index) => {
            const result = quote?.payments[index]
            const isBna = payment.method === "BNA_CUOTAS"
            return (
              <div key={payment.id} className="grid gap-3 rounded-lg border border-base-300 p-3 lg:grid-cols-[220px_1fr_180px_150px_auto] lg:items-end">
                <label className="form-control">
                  <span className="label-text">Medio</span>
                  <select className="select select-bordered" value={payment.method} onChange={(event) => patchPayment(payment.id, { method: event.target.value as QuoteMethod })}>
                    {methodOptions.filter((option) => option.value !== "BNA_CUOTAS" || quote?.settings.bnaInstallmentsEnabled).map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </label>

                <label className="form-control">
                  <span className="label-text">Monto entregado</span>
                  <input
                    className="input input-bordered"
                    inputMode="decimal"
                    value={payment.amount}
                    disabled={payment.useRemaining}
                    onChange={(event) => patchPayment(payment.id, { amount: event.target.value })}
                    placeholder={payment.method === "EFECTIVO_USD" || payment.method === "USDT" ? "USD / USDT" : "ARS"}
                  />
                </label>

                <label className="flex h-12 items-center gap-2 rounded-lg border border-base-300 px-3">
                  <input type="checkbox" className="checkbox checkbox-primary checkbox-sm" checked={payment.useRemaining} onChange={(event) => patchPayment(payment.id, { useRemaining: event.target.checked })} />
                  <span className="text-sm">Completar restante</span>
                </label>

                {isBna ? (
                  <label className="form-control">
                    <span className="label-text">Cuotas</span>
                    <select className="select select-bordered" value={payment.installments} onChange={(event) => patchPayment(payment.id, { installments: Number(event.target.value) })}>
                      {Array.from({ length: 12 }, (_, index) => index + 1).map((count) => <option key={count} value={count}>{count}</option>)}
                    </select>
                  </label>
                ) : <div />}

                <button type="button" className="btn btn-ghost btn-sm text-error" onClick={() => removePayment(payment.id)}>Quitar</button>

                {result ? (
                  <div className="lg:col-span-5 flex flex-wrap gap-x-5 gap-y-1 rounded-md bg-base-200/60 px-3 py-2 text-sm">
                    <span>Cobra: <strong>{formatNative(result)}</strong></span>
                    <span>Cubre: <strong>USD {Number(result.coveredUsd).toLocaleString("es-AR", { maximumFractionDigits: 2 })}</strong></span>
                    {result.installments && result.installmentAmount ? <span>BNA: <strong>{result.installments} cuotas de {formatArs(result.installmentAmount)}</strong></span> : null}
                    {result.customerRebateAmount ? <span>Reintegro cliente: <strong>{formatArs(result.customerRebateAmount)}</strong></span> : null}
                  </div>
                ) : null}
              </div>
            )
          })}
        </div>

        {quote ? (
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <div className="stat rounded-lg bg-base-200/60 p-4"><div className="stat-title">Precio base</div><div className="stat-value text-xl">USD {Number(quote.baseTotalUsd).toLocaleString("es-AR")}</div></div>
            <div className="stat rounded-lg bg-base-200/60 p-4"><div className="stat-title">Cubierto</div><div className="stat-value text-xl">USD {Number(quote.coveredUsd).toLocaleString("es-AR", { maximumFractionDigits: 2 })}</div></div>
            <div className={`stat rounded-lg p-4 ${Number(quote.remainingUsd) > 0.009 ? "bg-warning/15" : "bg-success/15"}`}><div className="stat-title">Restante</div><div className="stat-value text-xl">USD {Number(quote.remainingUsd).toLocaleString("es-AR", { maximumFractionDigits: 2 })}</div></div>
          </div>
        ) : null}
      </section>
    </div>
  )
}
