"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { PencilSquareIcon, PlusIcon, TrashIcon, XMarkIcon } from "@heroicons/react/24/outline"
import { useSession } from "next-auth/react"

type QuoteMethod = "EFECTIVO_USD" | "EFECTIVO_PESOS" | "TRANSFERENCIA_ARS" | "USDT" | "BNA_CUOTAS"
type QuoteVisibilityMode = "ADMIN" | "VENDEDOR"

type DraftPayment = {
  id: string
  method: QuoteMethod
  amount: string
  committedAmount: string | null
  useRemaining: boolean
  installments: number
}

type PaymentModalState = {
  mode: "create" | "edit"
  payment: DraftPayment
}

type PricingLine = {
  method: QuoteMethod
  currency: "ARS" | "USD" | "USDT"
  amount: string
  coveredUsd: string
  amountUsd: string | null
  exchangeRate: string | null
  surchargePct: string | null
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
    transferFeeRatePct: string | null
    bnaInstallmentsEnabled: boolean
    bnaMarkupRatePct: string | null
    bnaDefaultInstallments: number
    bnaCustomerRebatePct: string | null
    bnaCustomerRebateCapArs: string
  }
  visibilityMode: QuoteVisibilityMode
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
  { value: "BNA_CUOTAS", label: "BNA financiacion" },
]

function formatNative(line: PricingLine) {
  const value = Number(line.amount)
  if (line.currency === "ARS") return `$ ${new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 }).format(value)}`
  if (line.currency === "USDT") return `USDT ${new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 }).format(value)}`
  return `USD ${new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 }).format(value)}`
}

function formatUsd(value: string | number | null | undefined, maximumFractionDigits = 2) {
  return `USD ${new Intl.NumberFormat("es-AR", { maximumFractionDigits }).format(Number(value ?? 0))}`
}

function labelFor(method: QuoteMethod) {
  return methodOptions.find((option) => option.value === method)?.label ?? method
}

function formatArs(value: string | number | null | undefined) {
  return `$ ${new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 }).format(Number(value ?? 0))}`
}

function formatExchangeRate(value: string | number | null | undefined) {
  if (value == null) return null
  return `$ ${new Intl.NumberFormat("es-AR", { maximumFractionDigits: 4 }).format(Number(value))}`
}

function formatPct(value: string | number | null | undefined) {
  return `${new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 }).format(Number(value ?? 0))}%`
}

function normalizeDecimalInput(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return ""
  if (trimmed.includes(".") && trimmed.includes(",")) return trimmed.replace(/\./g, "").replace(",", ".")
  if (trimmed.includes(",")) return trimmed.replace(",", ".")
  if (/^\d{1,3}(\.\d{3})+$/.test(trimmed)) return trimmed.replace(/\./g, "")
  return trimmed
}

function isPositiveInput(value: string | null | undefined) {
  const normalized = normalizeDecimalInput(value ?? "")
  const parsed = Number(normalized)
  return Number.isFinite(parsed) && parsed > 0
}

function currencyForMethod(method: QuoteMethod) {
  if (method === "EFECTIVO_PESOS" || method === "TRANSFERENCIA_ARS" || method === "BNA_CUOTAS") return "ARS"
  if (method === "USDT") return "USDT"
  return "USD"
}

function isQuoteablePayment(payment: DraftPayment) {
  return payment.useRemaining || isPositiveInput(payment.committedAmount)
}

function quoteRequestPayments(payments: DraftPayment[]) {
  return payments.filter(isQuoteablePayment).map((payment) => ({
    method: payment.method,
    amount: payment.useRemaining ? undefined : normalizeDecimalInput(payment.committedAmount ?? ""),
    useRemaining: payment.useRemaining,
    installments: payment.method === "BNA_CUOTAS" ? payment.installments : undefined,
  }))
}

function paymentId() {
  return `quote-${crypto.randomUUID()}`
}

function createPayment(defaultInstallments: number): DraftPayment {
  return {
    id: paymentId(),
    method: "EFECTIVO_PESOS",
    amount: "",
    committedAmount: null,
    useRemaining: false,
    installments: defaultInstallments,
  }
}

export default function SalesQuoteCalculator() {
  const { data: session } = useSession()
  const [baseUsd, setBaseUsd] = useState("1000")
  const [payments, setPayments] = useState<DraftPayment[]>([])
  const [quote, setQuote] = useState<QuotePayload | null>(null)
  const [adminPreviewMode, setAdminPreviewMode] = useState<QuoteVisibilityMode>("ADMIN")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [paymentModal, setPaymentModal] = useState<PaymentModalState | null>(null)
  const [modalPreview, setModalPreview] = useState<QuotePayload | null>(null)
  const [modalLoading, setModalLoading] = useState(false)
  const [modalError, setModalError] = useState<string | null>(null)
  const modalMethodRef = useRef<HTMLSelectElement | null>(null)

  const availableMethodOptions = useMemo(
    () => methodOptions.filter((option) => option.value !== "BNA_CUOTAS" || quote?.settings.bnaInstallmentsEnabled !== false),
    [quote?.settings.bnaInstallmentsEnabled],
  )

  const quoteablePayments = useMemo(
    () => payments.filter(isQuoteablePayment),
    [payments],
  )

  const requestBody = useMemo(() => ({
    baseTotalUsd: normalizeDecimalInput(baseUsd),
    payments: quoteRequestPayments(payments),
  }), [baseUsd, payments])

  const resultByPaymentId = useMemo(() => {
    const map = new Map<string, PricingLine>()
    quote?.payments.forEach((line, index) => {
      const payment = quoteablePayments[index]
      if (payment) map.set(payment.id, line)
    })
    return map
  }, [quote?.payments, quoteablePayments])

  const modalPayments = useMemo(() => {
    if (!paymentModal) return []
    if (paymentModal.mode === "edit") {
      return payments.map((payment) => payment.id === paymentModal.payment.id ? paymentModal.payment : payment)
    }
    return [...payments, paymentModal.payment]
  }, [paymentModal, payments])

  const modalQuoteablePayments = useMemo(
    () => modalPayments.filter(isQuoteablePayment),
    [modalPayments],
  )

  const modalPreviewLine = useMemo(() => {
    if (!paymentModal || !modalPreview) return null
    const index = modalQuoteablePayments.findIndex((payment) => payment.id === paymentModal.payment.id)
    return index >= 0 ? modalPreview.payments[index] ?? null : null
  }, [modalPreview, modalQuoteablePayments, paymentModal])

  const canSaveModalPayment = paymentModal
    ? paymentModal.payment.useRemaining || isPositiveInput(paymentModal.payment.amount)
    : false
  const sessionVisibilityMode: QuoteVisibilityMode = session?.user?.activeRole === "ADMIN" ? "ADMIN" : "VENDEDOR"
  const serverVisibilityMode = quote?.visibilityMode ?? sessionVisibilityMode
  const canUseAdminView = serverVisibilityMode === "ADMIN"
  const visibilityMode = canUseAdminView ? adminPreviewMode : "VENDEDOR"
  const canSeePercentages = visibilityMode === "ADMIN"

  useEffect(() => {
    const parsed = Number(normalizeDecimalInput(baseUsd))
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

  useEffect(() => {
    if (!paymentModal) return
    modalMethodRef.current?.focus()
  }, [paymentModal?.payment.id])

  useEffect(() => {
    if (!paymentModal) {
      setModalPreview(null)
      setModalError(null)
      setModalLoading(false)
      return
    }

    if (!isQuoteablePayment(paymentModal.payment)) {
      setModalPreview(null)
      setModalError(null)
      setModalLoading(false)
      return
    }

    const parsed = Number(normalizeDecimalInput(baseUsd))
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setModalPreview(null)
      setModalError("El precio base USD debe ser mayor a 0.")
      return
    }

    const controller = new AbortController()
    const timer = window.setTimeout(async () => {
      setModalLoading(true)
      setModalError(null)
      try {
        const response = await fetch("/api/sales/quote", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            baseTotalUsd: normalizeDecimalInput(baseUsd),
            payments: quoteRequestPayments(modalPayments),
          }),
          signal: controller.signal,
        })
        const body = await response.json().catch(() => null)
        if (!response.ok) throw new Error(body?.error ?? "No se pudo calcular el medio de pago")
        setModalPreview(body as QuotePayload)
      } catch (loadError) {
        if (loadError instanceof DOMException && loadError.name === "AbortError") return
        setModalError(loadError instanceof Error ? loadError.message : "No se pudo calcular el medio de pago")
      } finally {
        if (!controller.signal.aborted) setModalLoading(false)
      }
    }, 200)

    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [baseUsd, modalPayments, paymentModal])

  function openCreatePaymentModal() {
    setPaymentModal({
      mode: "create",
      payment: createPayment(quote?.settings.bnaDefaultInstallments ?? 12),
    })
  }

  function openEditPaymentModal(payment: DraftPayment) {
    setPaymentModal({
      mode: "edit",
      payment: { ...payment },
    })
  }

  function closePaymentModal() {
    setPaymentModal(null)
  }

  function updateModalPayment(patch: Partial<DraftPayment>) {
    setPaymentModal((current) => current ? { ...current, payment: { ...current.payment, ...patch } } : current)
  }

  function changeModalMethod(method: QuoteMethod) {
    updateModalPayment({
      method,
      installments: method === "BNA_CUOTAS" ? quote?.settings.bnaDefaultInstallments ?? paymentModal?.payment.installments ?? 12 : paymentModal?.payment.installments ?? 12,
    })
  }

  function commitModalAmount() {
    setPaymentModal((current) => {
      if (!current) return current
      const normalized = normalizeDecimalInput(current.payment.amount)
      return {
        ...current,
        payment: {
          ...current.payment,
          amount: normalized,
          committedAmount: isPositiveInput(normalized) ? normalized : null,
        },
      }
    })
  }

  function savePaymentModal() {
    if (!paymentModal) return
    if (!canSaveModalPayment) {
      setModalError("Ingresa un importe valido o marca Completar restante.")
      return
    }

    const normalizedAmount = normalizeDecimalInput(paymentModal.payment.amount)
    const savedPayment = {
      ...paymentModal.payment,
      amount: paymentModal.payment.useRemaining ? "" : normalizedAmount,
      committedAmount: paymentModal.payment.useRemaining ? null : normalizedAmount,
    }

    setPayments((current) => {
      if (paymentModal.mode === "edit") {
        return current.map((payment) => payment.id === savedPayment.id ? savedPayment : payment)
      }
      return [...current, savedPayment]
    })
    closePaymentModal()
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
          <div className="flex w-full flex-col gap-3 md:w-auto md:items-end">
            {canUseAdminView ? (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold uppercase text-base-content/60">Vista</span>
                <div className="join">
                  {(["ADMIN", "VENDEDOR"] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      className={`btn btn-xs join-item ${visibilityMode === mode ? "btn-primary" : "btn-outline"}`}
                      onClick={() => setAdminPreviewMode(mode)}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <span className="badge badge-outline">Vista VENDEDOR</span>
            )}
            <label className="form-control w-full md:w-64">
              <span className="label-text font-medium">Precio venta USD</span>
              <input
                className="input input-bordered text-lg font-semibold"
                inputMode="decimal"
                value={baseUsd}
                onChange={(event) => setBaseUsd(event.target.value)}
                placeholder="1000"
              />
            </label>
          </div>
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
              {line.method === "BNA_CUOTAS" && line.installments && line.installmentAmount ? (
                <>
                  <p className="mt-3 text-xl font-bold leading-snug">{line.installments} cuotas sin interés de <span className="text-nowrap">{formatArs(line.installmentAmount)}</span></p>
                  {line.customerRebateAmount ? (
                    <p className="mt-2 text-sm font-medium text-base-content/70">Reintegro cliente: {formatArs(line.customerRebateAmount)}</p>
                  ) : null}
                  <div className="mt-3 space-y-0.5 text-xs text-base-content/50">
                    <p>Total final: {formatNative(line)}</p>
                    {line.exchangeRate ? <p>TC aplicado: {formatExchangeRate(line.exchangeRate)}</p> : null}
                  </div>
                </>
              ) : (
                <>
                  <p className="mt-2 text-xl font-bold">{formatNative(line)}</p>
                  {line.method === "TRANSFERENCIA_ARS" && Number(line.surchargeAmount) > 0 ? (
                    <p className="mt-1 text-xs text-base-content/50">
                      Incluye recargo transferencia{canSeePercentages && line.surchargePct ? ` ${formatPct(line.surchargePct)}` : ""}.
                    </p>
                  ) : null}
                  {line.exchangeRate ? (
                    <p className="mt-1 text-xs text-base-content/60">TC aplicado: {formatExchangeRate(line.exchangeRate)}</p>
                  ) : null}
                  {line.customerRebateAmount ? (
                    <p className="mt-1 text-xs text-base-content/60">Reintegro estimado cliente: {formatArs(line.customerRebateAmount)}</p>
                  ) : null}
                </>
              )}
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
          <button type="button" className="btn btn-primary btn-sm" onClick={openCreatePaymentModal}>
            <PlusIcon className="size-4" />
            Agregar medio
          </button>
        </div>

        <div className="mt-4 overflow-x-auto rounded-lg border border-base-300">
          <table className="table table-sm">
            <thead className="bg-base-200/70">
              <tr>
                <th>Medio</th>
                <th>Monto ingresado</th>
                <th>Tipo de cambio</th>
                <th>Total en dolares</th>
                <th>Detalle</th>
                <th className="text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {payments.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-sm text-base-content/50">Agrega medios para simular una combinacion.</td>
                </tr>
              ) : payments.map((payment) => {
                const result = resultByPaymentId.get(payment.id)
                return (
                  <tr key={payment.id}>
                    <td className="font-medium">{labelFor(payment.method)}</td>
                    <td>
                      {result ? (
                        <span className="tabular-nums">{formatNative(result)}</span>
                      ) : payment.useRemaining ? (
                        <span className="text-base-content/60">Completar restante</span>
                      ) : (
                        <span className="text-base-content/60">Pendiente</span>
                      )}
                    </td>
                    <td>{result?.exchangeRate ? formatExchangeRate(result.exchangeRate) : <span className="text-base-content/50">No aplica</span>}</td>
                    <td className="font-semibold tabular-nums">{result ? formatUsd(result.coveredUsd) : "-"}</td>
                    <td>
                      <div className="flex flex-wrap gap-1">
                        {payment.useRemaining ? <span className="badge badge-outline badge-sm">Completa restante</span> : null}
                        {result?.installments && result.installmentAmount ? <span className="badge badge-primary badge-sm">{result.installments} x {formatArs(result.installmentAmount)}</span> : null}
                        {result?.customerRebateAmount ? <span className="badge badge-ghost badge-sm">Reintegro {formatArs(result.customerRebateAmount)}</span> : null}
                        {result && Number(result.surchargeAmount) > 0 ? (
                          <span className="badge badge-outline badge-sm">
                            {canSeePercentages && result.surchargePct ? `Recargo ${formatPct(result.surchargePct)}` : "Incluye recargo"}
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td>
                      <div className="flex justify-end gap-1">
                        <button type="button" className="btn btn-ghost btn-xs" onClick={() => openEditPaymentModal(payment)} title="Editar medio">
                          <PencilSquareIcon className="size-4" />
                          Editar
                        </button>
                        <button type="button" className="btn btn-ghost btn-xs text-error" onClick={() => removePayment(payment.id)} title="Quitar medio">
                          <TrashIcon className="size-4" />
                          Quitar
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {quote ? (
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <div className="stat rounded-lg bg-base-200/60 p-4"><div className="stat-title">Precio base</div><div className="stat-value text-xl">{formatUsd(quote.baseTotalUsd, 0)}</div></div>
            <div className="stat rounded-lg bg-base-200/60 p-4"><div className="stat-title">Cubierto</div><div className="stat-value text-xl">{formatUsd(quote.coveredUsd)}</div></div>
            <div className={`stat rounded-lg p-4 ${Number(quote.remainingUsd) > 0.009 ? "bg-warning/15" : "bg-success/15"}`}><div className="stat-title">Restante</div><div className="stat-value text-xl">{formatUsd(quote.remainingUsd)}</div></div>
          </div>
        ) : null}
      </section>

      {paymentModal ? (
        <div className="modal modal-open">
          <div className="modal-box max-w-3xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-bold">{paymentModal.mode === "create" ? "Agregar medio" : "Editar medio"}</h3>
                <p className="text-sm text-base-content/60">El importe se procesa cuando salis del input.</p>
              </div>
              <button type="button" className="btn btn-ghost btn-sm btn-circle" onClick={closePaymentModal} title="Cerrar">
                <XMarkIcon className="size-5" />
              </button>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <label className="form-control">
                <span className="label-text">Medio de pago</span>
                <select
                  ref={modalMethodRef}
                  className="select select-bordered"
                  value={paymentModal.payment.method}
                  onChange={(event) => changeModalMethod(event.target.value as QuoteMethod)}
                >
                  {availableMethodOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>

              <label className="flex min-h-12 items-center gap-2 rounded-lg border border-base-300 px-3">
                <input
                  type="checkbox"
                  className="checkbox checkbox-primary checkbox-sm"
                  checked={paymentModal.payment.useRemaining}
                  onChange={(event) => updateModalPayment({
                    useRemaining: event.target.checked,
                    amount: event.target.checked ? "" : paymentModal.payment.amount,
                    committedAmount: event.target.checked ? null : paymentModal.payment.committedAmount,
                  })}
                />
                <span className="text-sm">Completar restante con este medio</span>
              </label>

              {!paymentModal.payment.useRemaining ? (
                <label className="form-control">
                  <span className="label-text">Monto entregado ({currencyForMethod(paymentModal.payment.method)})</span>
                  <input
                    className="input input-bordered"
                    inputMode="decimal"
                    value={paymentModal.payment.amount}
                    onChange={(event) => updateModalPayment({ amount: event.target.value, committedAmount: null })}
                    onBlur={commitModalAmount}
                    placeholder={currencyForMethod(paymentModal.payment.method) === "ARS" ? "300000" : "1000"}
                  />
                </label>
              ) : null}

              {paymentModal.payment.method === "BNA_CUOTAS" ? (
                <label className="form-control">
                  <span className="label-text">Cuotas</span>
                  <select
                    className="select select-bordered"
                    value={paymentModal.payment.installments}
                    onChange={(event) => updateModalPayment({ installments: Number(event.target.value) })}
                  >
                    {Array.from({ length: 12 }, (_, index) => index + 1).map((count) => <option key={count} value={count}>{count}</option>)}
                  </select>
                  {canSeePercentages && quote?.settings.bnaMarkupRatePct ? (
                    <span className="label-text-alt">Recargo BNA configurado: {formatPct(quote.settings.bnaMarkupRatePct)}</span>
                  ) : null}
                </label>
              ) : null}
            </div>

            <div className="mt-5 rounded-lg border border-base-300 bg-base-200/50 p-4">
              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <p className="text-xs text-base-content/60">Cliente paga</p>
                  <p className="mt-1 text-lg font-bold tabular-nums">{modalPreviewLine ? formatNative(modalPreviewLine) : "-"}</p>
                </div>
                <div>
                  <p className="text-xs text-base-content/60">Tipo de cambio</p>
                  <p className="mt-1 text-lg font-bold tabular-nums">{modalPreviewLine?.exchangeRate ? formatExchangeRate(modalPreviewLine.exchangeRate) : "No aplica"}</p>
                </div>
                <div>
                  <p className="text-xs text-base-content/60">Total en dolares</p>
                  <p className="mt-1 text-lg font-bold tabular-nums">{modalPreviewLine ? formatUsd(modalPreviewLine.coveredUsd) : "-"}</p>
                </div>
              </div>
              {modalPreviewLine?.installments && modalPreviewLine.installmentAmount ? (
                <p className="mt-3 text-sm font-semibold">
                  BNA: {modalPreviewLine.installments} cuotas de {formatArs(modalPreviewLine.installmentAmount)}
                  {canSeePercentages && modalPreviewLine.surchargePct ? ` con recargo ${formatPct(modalPreviewLine.surchargePct)}` : ""}
                </p>
              ) : null}
              {modalPreviewLine?.method === "TRANSFERENCIA_ARS" && Number(modalPreviewLine.surchargeAmount) > 0 ? (
                <p className="mt-3 text-sm font-semibold">
                  Transferencia ARS con recargo{canSeePercentages && modalPreviewLine.surchargePct ? ` ${formatPct(modalPreviewLine.surchargePct)}` : ""}
                </p>
              ) : null}
              {modalPreviewLine?.customerRebateAmount ? (
                <p className="mt-1 text-sm text-base-content/70">Reintegro estimado cliente: {formatArs(modalPreviewLine.customerRebateAmount)}</p>
              ) : null}
              {modalPreview ? (
                <p className="mt-3 text-xs text-base-content/60">Restante despues de guardar: {formatUsd(modalPreview.remainingUsd)}</p>
              ) : !paymentModal.payment.useRemaining && paymentModal.payment.amount.trim() !== "" && !paymentModal.payment.committedAmount ? (
                <p className="mt-3 text-xs text-base-content/60">Se calcula al salir del importe.</p>
              ) : null}
            </div>

            {modalError ? <div className="alert alert-error mt-4 py-3 text-sm">{modalError}</div> : null}

            <div className="modal-action">
              <button type="button" className="btn btn-ghost" onClick={closePaymentModal}>Cancelar</button>
              <button type="button" className="btn btn-primary" onClick={savePaymentModal} disabled={modalLoading || !canSaveModalPayment}>
                {modalLoading ? <span className="loading loading-spinner loading-xs" /> : null}
                Guardar medio
              </button>
            </div>
          </div>
          <button type="button" className="modal-backdrop" onClick={closePaymentModal}>Cerrar</button>
        </div>
      ) : null}
    </div>
  )
}
