"use client"

import type { PaymentDraft } from "@/components/sales/types"
import type { Currency, PaymentMethod } from "@prisma/client"
import { useEffect, useMemo, useState } from "react"

interface PaymentsSectionProps {
  payments: PaymentDraft[]
  setPayments: (payments: PaymentDraft[]) => void
  total: string
  disabled?: boolean
}

const PAYMENT_METHODS: PaymentMethod[] = [
  "EFECTIVO_PESOS",
  "EFECTIVO_USD",
  "TRANSFERENCIA_ARS",
  "TRANSFERENCIA_USD",
  "TARJETA",
  "BNA_CUOTAS",
  "USDT",
  "PLAN_CANJE",
]

const PRICED_METHODS = new Set<PaymentMethod>([
  "EFECTIVO_PESOS",
  "EFECTIVO_USD",
  "TRANSFERENCIA_ARS",
  "BNA_CUOTAS",
  "USDT",
])

type CashAccountOption = {
  id: string
  code: string
  name: string
  currency: Currency
  scope: "TENANT" | "BRANCH"
  branch?: { name: string } | null
}

type QuoteLine = {
  currency: Currency
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

type QuoteResponse = {
  exchangeRate: { rate: string }
  settings: { bnaDefaultInstallments: number; bnaInstallmentsEnabled: boolean }
  payments: QuoteLine[]
}

function methodCurrency(method: PaymentMethod): Currency {
  if (method === "EFECTIVO_PESOS" || method === "TRANSFERENCIA_ARS" || method === "TARJETA" || method === "BNA_CUOTAS") return "ARS"
  if (method === "USDT") return "USDT"
  return "USD"
}

function preferredAccountCode(method: PaymentMethod) {
  if (method === "EFECTIVO_PESOS") return "ARS_CASH"
  if (method === "EFECTIVO_USD") return "USD_CASH"
  if (method === "TRANSFERENCIA_ARS") return "ARS_TRANSFER"
  if (method === "USDT") return "USDT_WALLET"
  if (method === "BNA_CUOTAS") return "BNA_INSTALLMENTS"
  return null
}

function toNumber(value?: string | null) {
  const parsed = Number(value ?? 0)
  return Number.isFinite(parsed) ? parsed : 0
}

function formatArs(value?: string | null) {
  return `$ ${toNumber(value).toLocaleString("es-AR", { maximumFractionDigits: 2 })}`
}

export default function PaymentsSection({ payments, setPayments, total, disabled = false }: PaymentsSectionProps) {
  const [accounts, setAccounts] = useState<CashAccountOption[]>([])
  const [pricingPaymentId, setPricingPaymentId] = useState<string | null>(null)
  const [pricingError, setPricingError] = useState<string | null>(null)
  const [bnaDefaultInstallments, setBnaDefaultInstallments] = useState(12)
  const [bnaEnabled, setBnaEnabled] = useState(true)

  const totalPaid = useMemo(
    () => payments.reduce((acc, payment) => acc + toNumber(payment.coveredBaseUsd ?? payment.amountUsd ?? (payment.currency === "USD" || payment.currency === "USDT" ? payment.amount : "0")), 0),
    [payments],
  )

  const remaining = useMemo(() => Math.max(toNumber(total) - totalPaid, 0), [total, totalPaid])

  useEffect(() => {
    fetch("/api/cash-accounts", { cache: "no-store" })
      .then((response) => response.ok ? response.json() : { accounts: [] })
      .then((payload) => setAccounts(Array.isArray(payload.accounts) ? payload.accounts : []))
      .catch(() => setAccounts([]))
  }, [])

  useEffect(() => {
    if (toNumber(total) <= 0) return
    fetch("/api/sales/quote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ baseTotalUsd: total, payments: [] }),
    })
      .then((response) => response.ok ? response.json() : null)
      .then((payload: QuoteResponse | null) => {
        if (!payload) return
        setBnaDefaultInstallments(payload.settings.bnaDefaultInstallments)
        setBnaEnabled(payload.settings.bnaInstallmentsEnabled)
      })
      .catch(() => undefined)
  }, [total])

  const replacePayment = (id: string, next: PaymentDraft) => {
    setPayments(payments.map((payment) => payment._id === id ? next : payment))
  }

  async function pricePayment(payment: PaymentDraft) {
    if (!PRICED_METHODS.has(payment.method)) {
      const isParity = payment.currency === "USD" || payment.currency === "USDT"
      replacePayment(payment._id, {
        ...payment,
        amountUsd: isParity ? payment.amount : payment.amountUsd,
        coveredBaseUsd: isParity ? payment.amount : payment.coveredBaseUsd,
      })
      return
    }

    if (toNumber(payment.amount) <= 0) return
    setPricingPaymentId(payment._id)
    setPricingError(null)
    try {
      const response = await fetch("/api/sales/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          baseTotalUsd: total,
          payments: [{
            method: payment.method,
            amount: payment.amount,
            installments: payment.method === "BNA_CUOTAS" ? (payment.installments ?? bnaDefaultInstallments) : undefined,
          }],
        }),
      })
      const body = await response.json().catch(() => null)
      if (!response.ok) throw new Error(body?.error ?? "No se pudo calcular el pago")
      const line = (body as QuoteResponse).payments[0]
      if (!line) throw new Error("El servidor no devolvio la conversion del pago")
      replacePayment(payment._id, {
        ...payment,
        currency: line.currency,
        amount: line.amount,
        exchangeRate: line.exchangeRate ?? undefined,
        amountUsd: line.amountUsd ?? undefined,
        coveredBaseUsd: line.coveredUsd,
        surchargePct: line.surchargePct,
        surchargeAmount: line.surchargeAmount,
        installments: line.installments ?? undefined,
        installmentAmount: line.installmentAmount ?? undefined,
        customerRebatePct: line.customerRebatePct ?? undefined,
        customerRebateAmount: line.customerRebateAmount ?? undefined,
      })
    } catch (error) {
      setPricingError(error instanceof Error ? error.message : "No se pudo calcular el pago")
    } finally {
      setPricingPaymentId(null)
    }
  }

  async function completeRemaining(payment: PaymentDraft) {
    if (remaining <= 0 || !PRICED_METHODS.has(payment.method)) return
    setPricingPaymentId(payment._id)
    setPricingError(null)
    try {
      const response = await fetch("/api/sales/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          baseTotalUsd: remaining.toFixed(6),
          payments: [{
            method: payment.method,
            useRemaining: true,
            installments: payment.method === "BNA_CUOTAS" ? (payment.installments ?? bnaDefaultInstallments) : undefined,
          }],
        }),
      })
      const body = await response.json().catch(() => null)
      if (!response.ok) throw new Error(body?.error ?? "No se pudo completar el restante")
      const line = (body as QuoteResponse).payments[0]
      if (!line) throw new Error("El servidor no devolvio la conversion del pago")
      replacePayment(payment._id, {
        ...payment,
        currency: line.currency,
        amount: line.amount,
        exchangeRate: line.exchangeRate ?? undefined,
        amountUsd: line.amountUsd ?? undefined,
        coveredBaseUsd: line.coveredUsd,
        surchargePct: line.surchargePct,
        surchargeAmount: line.surchargeAmount,
        installments: line.installments ?? undefined,
        installmentAmount: line.installmentAmount ?? undefined,
        customerRebatePct: line.customerRebatePct ?? undefined,
        customerRebateAmount: line.customerRebateAmount ?? undefined,
      })
    } catch (error) {
      setPricingError(error instanceof Error ? error.message : "No se pudo completar el restante")
    } finally {
      setPricingPaymentId(null)
    }
  }

  const addPayment = () => {
    if (disabled) return
    const preferred = accounts.find((account) => account.code === "USD_CASH")
    setPayments([
      ...payments,
      {
        _id: `payment-${Date.now()}`,
        amount: remaining > 0 ? remaining.toFixed(2) : "0.00",
        amountUsd: remaining > 0 ? remaining.toFixed(2) : "0.00",
        coveredBaseUsd: remaining > 0 ? remaining.toFixed(6) : "0.000000",
        method: "EFECTIVO_USD",
        currency: "USD",
        cashAccountId: preferred?.id,
      },
    ])
  }

  const updatePayment = (id: string, updatedFields: Partial<PaymentDraft>) => {
    if (disabled) return
    setPayments(payments.map((payment) => payment._id === id ? { ...payment, ...updatedFields } : payment))
  }

  const changeMethod = (payment: PaymentDraft, method: PaymentMethod) => {
    const currency = methodCurrency(method)
    const code = preferredAccountCode(method)
    const account = code ? accounts.find((candidate) => candidate.code === code) : accounts.find((candidate) => candidate.currency === currency)
    updatePayment(payment._id, {
      method,
      currency,
      cashAccountId: account?.id,
      exchangeRate: undefined,
      amountUsd: undefined,
      coveredBaseUsd: undefined,
      surchargePct: undefined,
      surchargeAmount: undefined,
      installments: method === "BNA_CUOTAS" ? (payment.installments ?? bnaDefaultInstallments) : undefined,
      installmentAmount: undefined,
      customerRebatePct: undefined,
      customerRebateAmount: undefined,
    })
  }

  const removePayment = (id: string) => {
    if (disabled) return
    setPayments(payments.filter((payment) => payment._id !== id))
  }

  return (
    <div className="card border border-base-content/20 bg-base-100 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">Medio(s) de Pago</h2>
          <p className="text-xs text-base-content/60">El saldo se controla siempre contra USD base, aunque cada cobro quede registrado en su moneda nativa.</p>
        </div>
        <div className="text-right">
          <div className={`font-mono text-lg ${remaining > 0.009 ? "text-warning" : "text-success"}`}>USD {remaining.toFixed(2)}</div>
          <div className="text-xs text-base-content/70">Restante</div>
        </div>
      </div>

      {pricingError ? <div className="alert alert-error mt-3 py-2 text-sm">{pricingError}</div> : null}

      <div className="mt-4 flex flex-col gap-3">
        {payments.map((payment) => {
          const pricing = pricingPaymentId === payment._id
          const isBna = payment.method === "BNA_CUOTAS"
          return (
            <div key={payment._id} className="rounded-box bg-base-200 p-3">
              <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-6">
                <div className="form-control">
                  <label className="label-text pb-1">Metodo</label>
                  <select value={payment.method} onChange={(event) => changeMethod(payment, event.target.value as PaymentMethod)} className="select select-bordered select-sm" disabled={disabled}>
                    {PAYMENT_METHODS.filter((method) => method !== "BNA_CUOTAS" || bnaEnabled).map((method) => <option key={method} value={method}>{method.replace(/_/g, " ")}</option>)}
                  </select>
                </div>

                <div className="form-control">
                  <label className="label-text pb-1">Importe {payment.currency}</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="0.00"
                    value={payment.amount}
                    onChange={(event) => updatePayment(payment._id, { amount: event.target.value, coveredBaseUsd: undefined })}
                    onBlur={() => void pricePayment(payment)}
                    className="input input-bordered input-sm"
                    disabled={disabled || pricing}
                  />
                </div>

                {isBna ? (
                  <div className="form-control">
                    <label className="label-text pb-1">Cuotas</label>
                    <select
                      className="select select-bordered select-sm"
                      value={payment.installments ?? bnaDefaultInstallments}
                      onChange={(event) => updatePayment(payment._id, { installments: Number(event.target.value), coveredBaseUsd: undefined })}
                      onBlur={() => void pricePayment(payment)}
                      disabled={disabled || pricing}
                    >
                      {Array.from({ length: 12 }, (_, index) => index + 1).map((count) => <option key={count} value={count}>{count}</option>)}
                    </select>
                  </div>
                ) : null}

                {payment.method !== "PLAN_CANJE" ? (
                  <div className="form-control">
                    <label className="label-text pb-1">Caja</label>
                    <select
                      value={payment.cashAccountId || ""}
                      onChange={(event) => updatePayment(payment._id, { cashAccountId: event.target.value || undefined })}
                      className="select select-bordered select-sm"
                      disabled={disabled}
                    >
                      <option value="">Seleccionar caja</option>
                      {accounts.filter((account) => account.currency === payment.currency).map((account) => (
                        <option key={account.id} value={account.id}>{account.name}{account.scope === "BRANCH" && account.branch?.name ? ` · ${account.branch.name}` : ""}</option>
                      ))}
                    </select>
                  </div>
                ) : null}

                <div className="flex items-end gap-2">
                  {PRICED_METHODS.has(payment.method) ? (
                    <button type="button" className="btn btn-outline btn-sm" onClick={() => void completeRemaining(payment)} disabled={disabled || pricing || remaining <= 0.009}>
                      {pricing ? <span className="loading loading-spinner loading-xs" /> : null}
                      Completar
                    </button>
                  ) : null}
                  <button type="button" onClick={() => removePayment(payment._id)} className="btn btn-ghost btn-sm text-error" disabled={disabled}>Eliminar</button>
                </div>
              </div>

              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-base-content/70">
                <span>Cubre <strong>USD {toNumber(payment.coveredBaseUsd).toFixed(2)}</strong></span>
                {payment.exchangeRate ? <span>Blue venta <strong>$ {toNumber(payment.exchangeRate).toLocaleString("es-AR")}</strong></span> : null}
                {payment.method === "TRANSFERENCIA_ARS" && toNumber(payment.surchargePct) > 0 ? <span>Incluye recargo transferencia</span> : null}
                {payment.installments && payment.installmentAmount ? <span><strong>BNA · {payment.installments} cuotas de {formatArs(payment.installmentAmount)}</strong></span> : null}
                {payment.customerRebateAmount ? <span>Reintegro cliente <strong>{formatArs(payment.customerRebateAmount)}</strong></span> : null}
              </div>
            </div>
          )
        })}
      </div>

      <button type="button" onClick={addPayment} className="btn btn-outline btn-sm mt-4 w-full" disabled={disabled}>+ Agregar Pago</button>
    </div>
  )
}
