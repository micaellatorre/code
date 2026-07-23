"use client"

import { useEffect, useMemo, useState } from "react"
import { PlusIcon, TrashIcon } from "@heroicons/react/24/outline"
import { useSession } from "next-auth/react"
import type { SerializedSale, SalePaymentSummary } from "./types"
import { getSaleBuyerName, toNumber } from "./salesUtils"

type SaleStatusValue = "CONFIRMADA" | "SENADA" | "CANCELADA"
type CurrencyValue = "USD" | "ARS" | "USDT"
type PaymentMethodValue = "EFECTIVO_PESOS" | "EFECTIVO_USD" | "TRANSFERENCIA_ARS" | "TRANSFERENCIA_USD" | "TARJETA" | "USDT"

type CashAccountOption = {
  id: string
  name: string
  currency: CurrencyValue
  scope: "TENANT" | "BRANCH"
  branch?: { name: string } | null
}

type PaymentDraft = {
  key: string
  id?: string | null
  method: PaymentMethodValue
  currency: CurrencyValue
  amount: string
  exchangeRate: string
  cashAccountId: string
  note: string
  paidAt: string
}

type Props = {
  sale: SerializedSale
  open: boolean
  canSave: boolean
  onClose: () => void
  onSaved: (sale: SerializedSale) => void
}

const statusOptions: SaleStatusValue[] = ["CONFIRMADA", "SENADA", "CANCELADA"]

function makeId() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`
}

function todayInputValue() {
  return new Date().toISOString().slice(0, 10)
}

function paidAtInputValue(value: string | null | undefined) {
  if (!value) return todayInputValue()
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return todayInputValue()
  return date.toISOString().slice(0, 10)
}

function asStatus(value: string | null | undefined): SaleStatusValue {
  return value === "SENADA" || value === "CANCELADA" ? value : "CONFIRMADA"
}

function asCurrency(value: string | null | undefined): CurrencyValue {
  return value === "ARS" || value === "USDT" ? value : "USD"
}

function asPaymentMethod(value: string | null | undefined): PaymentMethodValue {
  if (
    value === "EFECTIVO_PESOS" ||
    value === "EFECTIVO_USD" ||
    value === "TRANSFERENCIA_ARS" ||
    value === "TRANSFERENCIA_USD" ||
    value === "TARJETA" ||
    value === "USDT"
  ) {
    return value
  }
  return "EFECTIVO_USD"
}

function paymentToDraft(payment: SalePaymentSummary): PaymentDraft {
  return {
    key: payment.id ?? makeId(),
    id: payment.id ?? null,
    method: asPaymentMethod(String(payment.method ?? "")),
    currency: asCurrency(String(payment.currency ?? "")),
    amount: payment.amount ?? "",
    exchangeRate: payment.exchangeRate ?? "",
    cashAccountId: payment.cashAccountId ?? "",
    note: payment.note ?? "",
    paidAt: paidAtInputValue(payment.paidAt),
  }
}

function newPaymentDraft(amount = ""): PaymentDraft {
  return {
    key: makeId(),
    id: null,
    method: "EFECTIVO_USD",
    currency: "USD",
    amount,
    exchangeRate: "",
    cashAccountId: "",
    note: "",
    paidAt: todayInputValue(),
  }
}

function formatUsd(value: number) {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(value)
}

export default function SaleStatusUpdateModal({ sale, open, canSave, onClose, onSaved }: Props) {
  const { data: session } = useSession()
  const [status, setStatus] = useState<SaleStatusValue>(asStatus(sale.status))
  const [notes, setNotes] = useState(sale.notes ?? "")
  const [payments, setPayments] = useState<PaymentDraft[]>([])
  const [cashAccounts, setCashAccounts] = useState<CashAccountOption[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const total = toNumber(sale.total)
  const amountPaid = useMemo(() => payments.reduce((acc, payment) => acc + toNumber(payment.amount), 0), [payments])
  const balanceDue = total - amountPaid
  const executor = session?.user?.name || session?.user?.email || "Usuario actual"
  const activeRole = (session?.user as { activeRole?: string } | undefined)?.activeRole ?? "-"

  useEffect(() => {
    if (!open) return
    setStatus(asStatus(sale.status))
    setNotes(sale.notes ?? "")
    setPayments(sale.payments.map(paymentToDraft))
    setError(null)
  }, [open, sale])

  useEffect(() => {
    if (!open) return
    fetch("/api/cash-accounts", { cache: "no-store" })
      .then((response) => response.ok ? response.json() : { accounts: [] })
      .then((payload) => setCashAccounts(Array.isArray(payload.accounts) ? payload.accounts : []))
      .catch(() => setCashAccounts([]))
  }, [open])

  function updatePayment(key: string, patch: Partial<PaymentDraft>) {
    setPayments((current) => current.map((payment) => payment.key === key ? { ...payment, ...patch } : payment))
  }

  function addPayment() {
    setPayments((current) => [...current, newPaymentDraft(Math.max(0, balanceDue).toFixed(2))])
  }

  async function save() {
    setSaving(true)
    setError(null)
    try {
      const body = {
        status,
        notes: notes || null,
        payments: payments.map((payment) => ({
          id: payment.id || null,
          method: payment.method,
          currency: payment.currency,
          amount: payment.amount,
          exchangeRate: payment.exchangeRate || null,
          cashAccountId: payment.cashAccountId || null,
          note: payment.note || null,
          paidAt: payment.paidAt,
        })),
      }
      const response = await fetch(`/api/sales/${sale.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok) throw new Error(payload?.error ?? "No se pudo actualizar la venta.")
      if (payload?.sale) onSaved(payload.sale as SerializedSale)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo actualizar la venta.")
    } finally {
      setSaving(false)
    }
  }

  if (!open) return null

  return (
    <div className="modal modal-open" role="dialog" aria-modal="true" aria-labelledby="sale-status-modal-title">
      <div className="modal-box max-h-[88vh] max-w-4xl overflow-y-auto rounded-lg">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="sale-status-modal-title" className="text-lg font-semibold">Actualizar estado de venta</h2>
            <p className="mt-1 text-sm text-base-content/60">Ejecuta: {executor} · Rol activo: {activeRole}</p>
          </div>
          <button type="button" className="btn btn-square btn-ghost btn-sm" aria-label="Cerrar" onClick={onClose} disabled={saving}>x</button>
        </div>

        {error ? <div className="alert alert-error mt-4 text-sm">{error}</div> : null}
        {!canSave ? <div className="alert alert-warning mt-4 text-sm">Tu rol puede ver esta accion, pero esta venta confirmada solo puede modificarse con ADMIN activo.</div> : null}

        <div className="mt-5 grid gap-3 sm:grid-cols-4">
          <div className="rounded border border-base-300 p-3">
            <div className="text-xs uppercase text-base-content/50">Total</div>
            <div className="font-semibold">{formatUsd(total)}</div>
          </div>
          <div className="rounded border border-base-300 p-3">
            <div className="text-xs uppercase text-base-content/50">Pagado</div>
            <div className="font-semibold">{formatUsd(amountPaid)}</div>
          </div>
          <div className="rounded border border-base-300 p-3">
            <div className="text-xs uppercase text-base-content/50">Restante</div>
            <div className={`font-semibold ${balanceDue > 0 ? "text-warning" : "text-success"}`}>{formatUsd(Math.max(0, balanceDue))}</div>
          </div>
          <div className="rounded border border-base-300 p-3">
            <div className="text-xs uppercase text-base-content/50">Venta</div>
            <div className="truncate font-semibold">{sale.id}</div>
          </div>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_1.4fr]">
          <section className="rounded border border-base-300 bg-base-100 p-4">
            <h3 className="font-semibold">Datos de venta</h3>
            <div className="mt-3 space-y-3">
              <label className="form-control">
                <span className="label-text">Estado</span>
                <select className="select select-bordered select-sm" value={status} onChange={(event) => setStatus(event.target.value as SaleStatusValue)} disabled={saving || !canSave}>
                  {statusOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              </label>
              <label className="form-control">
                <span className="label-text">Notas</span>
                <textarea className="textarea textarea-bordered min-h-24" value={notes} onChange={(event) => setNotes(event.target.value)} disabled={saving || !canSave} />
              </label>
              <div className="rounded border border-base-300 bg-base-200/40 p-3 text-sm">
                <div className="font-medium">{getSaleBuyerName(sale)}</div>
                <div className="text-base-content/60">{sale.items.map((item) => item.product.modelName).join(" · ")}</div>
              </div>
            </div>
          </section>

          <section className="rounded border border-base-300 bg-base-100 p-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-semibold">Pagos</h3>
              <button type="button" className="btn btn-outline btn-xs" onClick={addPayment} disabled={saving || !canSave}>
                <PlusIcon className="size-4" />
                Agregar pago
              </button>
            </div>
            <div className="mt-3 space-y-3">
              {payments.map((payment, index) => (
                <div key={payment.key} className="rounded border border-base-300 p-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="text-sm font-medium">Pago {index + 1}</span>
                    <button type="button" className="btn btn-square btn-ghost btn-xs" aria-label="Quitar pago" onClick={() => setPayments((current) => current.filter((item) => item.key !== payment.key))} disabled={saving || !canSave}>
                      <TrashIcon className="size-4" />
                    </button>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <select className="select select-bordered select-sm" value={payment.method} onChange={(event) => updatePayment(payment.key, { method: event.target.value as PaymentMethodValue })} disabled={saving || !canSave}>
                      <option value="EFECTIVO_USD">Efectivo USD</option>
                      <option value="EFECTIVO_PESOS">Efectivo ARS</option>
                      <option value="TRANSFERENCIA_USD">Transferencia USD</option>
                      <option value="TRANSFERENCIA_ARS">Transferencia ARS</option>
                      <option value="USDT">USDT</option>
                      <option value="TARJETA">Tarjeta</option>
                    </select>
                    <select className="select select-bordered select-sm" value={payment.currency} onChange={(event) => updatePayment(payment.key, { currency: event.target.value as CurrencyValue, cashAccountId: "" })} disabled={saving || !canSave}>
                      <option value="USD">USD</option>
                      <option value="ARS">ARS</option>
                      <option value="USDT">USDT</option>
                    </select>
                    <input className="input input-bordered input-sm" type="number" step="0.01" placeholder="Monto" value={payment.amount} onChange={(event) => updatePayment(payment.key, { amount: event.target.value })} disabled={saving || !canSave} />
                    <input className="input input-bordered input-sm" type="number" step="0.01" placeholder={payment.currency === "ARS" ? "TC obligatorio" : "TC"} value={payment.exchangeRate} onChange={(event) => updatePayment(payment.key, { exchangeRate: event.target.value })} disabled={saving || !canSave} />
                    <select className="select select-bordered select-sm sm:col-span-2" value={payment.cashAccountId} onChange={(event) => updatePayment(payment.key, { cashAccountId: event.target.value })} disabled={saving || !canSave}>
                      <option value="">Seleccionar caja</option>
                      {cashAccounts.filter((account) => account.currency === payment.currency).map((account) => (
                        <option key={account.id} value={account.id}>{account.name} · {account.currency}{account.scope === "BRANCH" && account.branch?.name ? ` · ${account.branch.name}` : ""}</option>
                      ))}
                    </select>
                    <input className="input input-bordered input-sm" type="date" value={payment.paidAt} onChange={(event) => updatePayment(payment.key, { paidAt: event.target.value })} disabled={saving || !canSave} />
                    <input className="input input-bordered input-sm" placeholder="Nota" value={payment.note} onChange={(event) => updatePayment(payment.key, { note: event.target.value })} disabled={saving || !canSave} />
                  </div>
                </div>
              ))}
              {!payments.length ? <div className="rounded border border-dashed border-base-300 p-4 text-center text-sm text-base-content/60">Sin pagos cargados.</div> : null}
            </div>
          </section>
        </div>

        <div className="modal-action">
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={saving}>Cancelar</button>
          <button type="button" className="btn btn-primary" onClick={save} disabled={saving || !canSave}>
            {saving ? <span className="loading loading-spinner loading-xs" /> : null}
            Guardar cambios
          </button>
        </div>
      </div>
      <button type="button" className="modal-backdrop" aria-label="Cerrar" onClick={onClose} disabled={saving}>cerrar</button>
    </div>
  )
}
