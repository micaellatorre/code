"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ArrowPathIcon, ClockIcon } from "@heroicons/react/24/outline"
import { formatInTimeZone } from "date-fns-tz"
import { AR_TIME_ZONE } from "@/lib/timezone"
import PurchaseTimelineModal from "./PurchaseTimelineModal"

export type PurchaseRow = {
  id: string
  supplier: { id: string; name: string } | null
  branch: { id: string; code: string; name: string } | null
  date: string
  currency: string
  totalCost: string
  paidUsd?: string
  paymentStatus: "PAID" | "PARTIAL" | "CURRENT_ACCOUNT"
  totalUnits: number
  productTypes: string[]
  items: Array<{
    id: string
    units: number
    product: { id: string; type: string; modelName: string; imei: string | null; state?: string | null }
  }>
}

type Props = {
  purchases: PurchaseRow[]
  canUpdatePaymentStatus?: boolean
}

const paymentStatusOptions: PurchaseRow["paymentStatus"][] = ["PAID", "PARTIAL", "CURRENT_ACCOUNT"]
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
  method: PaymentMethodValue
  currency: CurrencyValue
  amount: string
  exchangeRate: string
  cashAccountId: string
  note: string
}

function paymentLabel(status: PurchaseRow["paymentStatus"]) {
  if (status === "PAID") return "Pagada"
  if (status === "PARTIAL") return "Parcial"
  return "Cuenta corriente"
}

function defaultPaymentMethod(currency: string): PaymentMethodValue {
  if (currency === "ARS") return "EFECTIVO_PESOS"
  if (currency === "USDT") return "USDT"
  return "EFECTIVO_USD"
}

function asCurrency(value: string): CurrencyValue {
  return value === "ARS" || value === "USDT" ? value : "USD"
}

export default function PurchasesTable({ purchases, canUpdatePaymentStatus = false }: Props) {
  const [timelinePurchaseId, setTimelinePurchaseId] = useState<string | null>(null)
  const [paymentModalPurchase, setPaymentModalPurchase] = useState<PurchaseRow | null>(null)
  const [paymentItemsOpen, setPaymentItemsOpen] = useState(false)
  const [draftPaymentStatus, setDraftPaymentStatus] = useState<PurchaseRow["paymentStatus"]>("CURRENT_ACCOUNT")
  const [paymentDraft, setPaymentDraft] = useState<PaymentDraft>({
    method: "EFECTIVO_USD",
    currency: "USD",
    amount: "",
    exchangeRate: "",
    cashAccountId: "",
    note: "",
  })
  const [markProductsInStock, setMarkProductsInStock] = useState(false)
  const [cashAccounts, setCashAccounts] = useState<CashAccountOption[]>([])
  const [paymentStatuses, setPaymentStatuses] = useState<Record<string, PurchaseRow["paymentStatus"]>>({})
  const [paidUsdByPurchase, setPaidUsdByPurchase] = useState<Record<string, string>>({})
  const [savingPaymentId, setSavingPaymentId] = useState<string | null>(null)
  const [paymentError, setPaymentError] = useState<string | null>(null)

  const paymentModalPendingStockCount = paymentModalPurchase
    ? paymentModalPurchase.items.filter((item) => item.product.state === "EN_CAMINO").reduce((acc, item) => acc + item.units, 0)
    : 0

  useEffect(() => {
    setPaymentStatuses(Object.fromEntries(purchases.map((purchase) => [purchase.id, purchase.paymentStatus])))
    setPaidUsdByPurchase(Object.fromEntries(purchases.map((purchase) => [purchase.id, purchase.paidUsd ?? "0"])))
  }, [purchases])

  useEffect(() => {
    fetch("/api/cash-accounts", { cache: "no-store" })
      .then((response) => response.ok ? response.json() : { accounts: [] })
      .then((payload) => setCashAccounts(Array.isArray(payload.accounts) ? payload.accounts : []))
      .catch(() => setCashAccounts([]))
  }, [])

  function openPaymentStatusModal(purchase: PurchaseRow) {
    const currentStatus = paymentStatuses[purchase.id] ?? purchase.paymentStatus
    const currency = asCurrency(purchase.currency)
    const pendingUsd = Math.max(0, Number(purchase.totalCost) - Number(paidUsdByPurchase[purchase.id] ?? purchase.paidUsd ?? 0))
    setPaymentError(null)
    setPaymentModalPurchase(purchase)
    setPaymentItemsOpen(false)
    setDraftPaymentStatus(currentStatus)
    setMarkProductsInStock(false)
    setPaymentDraft({
      method: defaultPaymentMethod(currency),
      currency,
      amount: currentStatus === "PAID" ? "" : pendingUsd.toFixed(2),
      exchangeRate: "",
      cashAccountId: "",
      note: "",
    })
  }

  function closePaymentStatusModal() {
    if (savingPaymentId) return
    setPaymentModalPurchase(null)
  }

  function changeDraftPaymentStatus(nextStatus: PurchaseRow["paymentStatus"]) {
    setDraftPaymentStatus(nextStatus)
    if (!paymentModalPurchase || nextStatus === "CURRENT_ACCOUNT" || paymentDraft.amount) return
    const pendingUsd = Math.max(0, Number(paymentModalPurchase.totalCost) - Number(paidUsdByPurchase[paymentModalPurchase.id] ?? paymentModalPurchase.paidUsd ?? 0))
    setPaymentDraft((current) => ({ ...current, amount: pendingUsd.toFixed(2) }))
  }

  async function updatePaymentStatus(purchase: PurchaseRow, nextStatus: PurchaseRow["paymentStatus"]) {
    const previousStatus = paymentStatuses[purchase.id] ?? purchase.paymentStatus
    const shouldRegisterPayment = Number(paymentDraft.amount || 0) > 0
    if (nextStatus === previousStatus && !markProductsInStock && !shouldRegisterPayment) {
      setPaymentModalPurchase(null)
      return
    }

    setPaymentError(null)
    setSavingPaymentId(purchase.id)
    setPaymentStatuses((current) => ({ ...current, [purchase.id]: nextStatus }))

    try {
      const response = await fetch(`/api/purchases/${purchase.id}/payment-status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentStatus: nextStatus,
          markProductsInStock,
          payment: shouldRegisterPayment
            ? {
              method: paymentDraft.method,
              currency: paymentDraft.currency,
              amount: paymentDraft.amount,
              exchangeRate: paymentDraft.exchangeRate || null,
              cashAccountId: paymentDraft.cashAccountId || null,
              paidAt: new Date().toISOString(),
              note: paymentDraft.note || null,
            }
            : null,
        }),
      })
      const data = await response.json().catch(() => null)
      if (!response.ok) throw new Error(data?.error ?? "No se pudo actualizar el estado de pago")
      setPaymentStatuses((current) => ({ ...current, [purchase.id]: data.purchase.paymentStatus }))
      setPaidUsdByPurchase((current) => ({ ...current, [purchase.id]: data.purchase.paidUsd ?? current[purchase.id] ?? "0" }))
      setPaymentModalPurchase(null)
    } catch (error) {
      setPaymentStatuses((current) => ({ ...current, [purchase.id]: previousStatus }))
      setPaymentError(error instanceof Error ? error.message : "No se pudo actualizar el estado de pago")
    } finally {
      setSavingPaymentId(null)
    }
  }

  return (
    <>
      <div className="overflow-x-auto rounded-box border border-base-content/5 bg-base-100">
        <table className="table table-zebra w-full">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Proveedor</th>
              <th>Items</th>
              <th>Total</th>
              <th>Sucursal</th>
              <th>Pago</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {purchases.map((purchase) => (
              <tr key={purchase.id}>
                <td>{formatInTimeZone(new Date(purchase.date), AR_TIME_ZONE, "dd/MM/yyyy")}</td>
                <td>{purchase.supplier?.name ?? "-"}</td>
                <td>
                  <div className="max-w-sm">
                    <div className="font-medium">{purchase.totalUnits} unidades</div>
                    <div className="truncate text-xs text-base-content/60">
                      {purchase.items.slice(0, 3).map((item) => `${item.product.modelName}${item.product.imei ? ` #${item.product.imei}` : ""}`).join(", ")}
                    </div>
                  </div>
                </td>
                <td>{purchase.currency} {Number(purchase.totalCost).toFixed(2)}</td>
                <td>{purchase.branch?.name ?? "Sin sucursal"}</td>
                <td>
                  {!canUpdatePaymentStatus ? (
                    <span className="badge badge-outline">{paymentLabel(paymentStatuses[purchase.id] ?? purchase.paymentStatus)}</span>
                  ) : (
                    <button
                      type="button"
                      className="badge badge-outline group min-w-32 cursor-pointer justify-center gap-1 transition-colors hover:border-primary hover:bg-primary hover:text-primary-content"
                      title="Actualizar estado de pago"
                      aria-label={`Actualizar estado de pago: ${paymentLabel(paymentStatuses[purchase.id] ?? purchase.paymentStatus)}`}
                      disabled={savingPaymentId === purchase.id}
                      onClick={() => openPaymentStatusModal(purchase)}
                    >
                      <span className="group-hover:hidden">
                        {paymentLabel(paymentStatuses[purchase.id] ?? purchase.paymentStatus)}
                      </span>
                      <span className="hidden items-center gap-1 group-hover:inline-flex">
                        <ArrowPathIcon className="size-3" />
                        Actualizar
                      </span>
                    </button>
                  )}
                </td>
                <td>
                  <button
                    type="button"
                    className="btn btn-square btn-ghost btn-xs"
                    title="Ver seguimiento"
                    aria-label="Ver seguimiento de la compra"
                    onClick={() => setTimelinePurchaseId(purchase.id)}
                  >
                    <ClockIcon className="size-4" />
                  </button>
                </td>
              </tr>
            ))}
            {!purchases.length ? (
              <tr><td colSpan={7} className="py-8 text-center text-base-content/60">No hay compras para los filtros seleccionados.</td></tr>
            ) : null}
          </tbody>
        </table>
      </div>
      {paymentError ? <div className="alert alert-error mt-3 text-sm">{paymentError}</div> : null}
      {paymentModalPurchase ? (
        <div className="modal modal-open" role="dialog" aria-modal="true" aria-labelledby="purchase-payment-status-title">
          <div className="modal-box max-w-2xl rounded-lg">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 id="purchase-payment-status-title" className="text-lg font-semibold">Confirmar actualizacion de pago</h2>
                <p className="mt-1 text-sm text-base-content/60">
                  {paymentModalPurchase.supplier?.name ?? "Proveedor sin nombre"} · {formatInTimeZone(new Date(paymentModalPurchase.date), AR_TIME_ZONE, "dd/MM/yyyy")}
                </p>
              </div>
              <button type="button" className="btn btn-square btn-ghost btn-sm" aria-label="Cerrar" onClick={closePaymentStatusModal}>x</button>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <div className="rounded border border-base-300 p-3">
                <div className="text-xs uppercase text-base-content/50">Total</div>
                <div className="font-semibold">{paymentModalPurchase.currency} {Number(paymentModalPurchase.totalCost).toFixed(2)}</div>
              </div>
              <div className="rounded border border-base-300 p-3">
                <div className="text-xs uppercase text-base-content/50">Sucursal</div>
                <div className="font-semibold">{paymentModalPurchase.branch?.name ?? "Sin sucursal"}</div>
              </div>
              <button
                type="button"
                className={`rounded border p-3 text-left transition-colors hover:border-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary ${paymentItemsOpen ? "border-primary bg-primary/5" : "border-base-300"}`}
                aria-expanded={paymentItemsOpen}
                onClick={() => setPaymentItemsOpen((open) => !open)}
              >
                <div className="text-xs uppercase text-base-content/50">Items</div>
                <div className="font-semibold">{paymentModalPurchase.totalUnits} unidades</div>
              </button>
            </div>

            {paymentItemsOpen ? (
              <div className="mt-3 rounded border border-base-300 bg-base-100">
                {paymentModalPurchase.items.map((item) => (
                  <div key={item.id} className="grid gap-2 border-b border-base-300 p-3 text-sm last:border-b-0 sm:grid-cols-[1fr_auto_auto] sm:items-center">
                    <div className="min-w-0">
                      <Link
                        className="font-medium text-primary hover:underline"
                        href={`/dashboard/products/${item.product.id}/edit`}
                      >
                        {item.product.modelName}
                      </Link>
                      {item.product.imei ? <div className="truncate text-xs text-base-content/60">IMEI {item.product.imei}</div> : null}
                    </div>
                    <span className="text-base-content/70">{item.units} un.</span>
                    <span className="badge badge-outline badge-sm">{item.product.state ?? "Sin estado"}</span>
                  </div>
                ))}
              </div>
            ) : null}

            <div className="mt-4 rounded border border-base-300 bg-base-200/40 p-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <div className="text-xs uppercase text-base-content/50">Estado actual</div>
                  <div className="mt-1 badge badge-outline">{paymentLabel(paymentStatuses[paymentModalPurchase.id] ?? paymentModalPurchase.paymentStatus)}</div>
                </div>
                <label className="form-control w-full">
                  <span className="label-text text-xs uppercase text-base-content/50">Nuevo estado</span>
                  <select
                    className="select select-bordered select-sm mt-1"
                    value={draftPaymentStatus}
                    disabled={savingPaymentId === paymentModalPurchase.id}
                    onChange={(event) => changeDraftPaymentStatus(event.target.value as PurchaseRow["paymentStatus"])}
                  >
                    {paymentStatusOptions.map((status) => (
                      <option key={status} value={status}>{paymentLabel(status)}</option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <label className="form-control">
                  <span className="label-text">Medio de pago</span>
                  <select
                    className="select select-bordered select-sm"
                    value={paymentDraft.method}
                    disabled={savingPaymentId === paymentModalPurchase.id}
                    onChange={(event) => setPaymentDraft((current) => ({ ...current, method: event.target.value as PaymentMethodValue }))}
                  >
                    <option value="EFECTIVO_USD">Efectivo USD</option>
                    <option value="EFECTIVO_PESOS">Efectivo ARS</option>
                    <option value="TRANSFERENCIA_USD">Transferencia USD</option>
                    <option value="TRANSFERENCIA_ARS">Transferencia ARS</option>
                    <option value="USDT">USDT</option>
                    <option value="TARJETA">Tarjeta</option>
                  </select>
                </label>
                <label className="form-control">
                  <span className="label-text">Moneda</span>
                  <select
                    className="select select-bordered select-sm"
                    value={paymentDraft.currency}
                    disabled={savingPaymentId === paymentModalPurchase.id}
                    onChange={(event) => setPaymentDraft((current) => ({ ...current, currency: event.target.value as CurrencyValue, cashAccountId: "" }))}
                  >
                    <option value="USD">USD</option>
                    <option value="ARS">ARS</option>
                    <option value="USDT">USDT</option>
                  </select>
                </label>
                <label className="form-control">
                  <span className="label-text">Monto</span>
                  <input
                    className="input input-bordered input-sm"
                    type="number"
                    step="0.01"
                    value={paymentDraft.amount}
                    disabled={savingPaymentId === paymentModalPurchase.id}
                    onChange={(event) => setPaymentDraft((current) => ({ ...current, amount: event.target.value }))}
                  />
                </label>
                <label className="form-control">
                  <span className="label-text">Tipo de cambio</span>
                  <input
                    className="input input-bordered input-sm"
                    type="number"
                    step="0.01"
                    placeholder={paymentDraft.currency === "ARS" ? "Obligatorio para ARS" : "Opcional"}
                    value={paymentDraft.exchangeRate}
                    disabled={savingPaymentId === paymentModalPurchase.id}
                    onChange={(event) => setPaymentDraft((current) => ({ ...current, exchangeRate: event.target.value }))}
                  />
                </label>
                <label className="form-control sm:col-span-2">
                  <span className="label-text">Caja</span>
                  <select
                    className="select select-bordered select-sm"
                    value={paymentDraft.cashAccountId}
                    disabled={savingPaymentId === paymentModalPurchase.id}
                    onChange={(event) => setPaymentDraft((current) => ({ ...current, cashAccountId: event.target.value }))}
                  >
                    <option value="">Seleccionar caja</option>
                    {cashAccounts.filter((account) => account.currency === paymentDraft.currency).map((account) => (
                      <option key={account.id} value={account.id}>{account.name} · {account.currency}{account.scope === "BRANCH" && account.branch?.name ? ` · ${account.branch.name}` : ""}</option>
                    ))}
                  </select>
                </label>
                <label className="form-control sm:col-span-2">
                  <span className="label-text">Nota</span>
                  <input
                    className="input input-bordered input-sm"
                    value={paymentDraft.note}
                    disabled={savingPaymentId === paymentModalPurchase.id}
                    onChange={(event) => setPaymentDraft((current) => ({ ...current, note: event.target.value }))}
                  />
                </label>
              </div>
              <div className="alert mt-4 items-start rounded-lg border border-info/30 bg-info/10 text-sm text-base-content">
                <label className="flex w-full items-start gap-3">
                  <input
                    type="checkbox"
                    className="checkbox checkbox-primary checkbox-sm"
                    checked={markProductsInStock}
                    disabled={savingPaymentId === paymentModalPurchase.id || paymentModalPendingStockCount === 0}
                    onChange={(event) => setMarkProductsInStock(event.target.checked)}
                  />
                  <span>
                    <span className="block font-medium">Marcar productos como En stock</span>
                    <span className="block text-base-content/70">
                      {paymentModalPendingStockCount > 0
                        ? `Actualiza ${paymentModalPendingStockCount} unidades relacionadas a esta compra que estan En camino.`
                        : "No hay productos En camino asociados a esta compra."}
                    </span>
                  </span>
                </label>
              </div>
              <p className="mt-4 text-sm text-base-content/70">
                Al confirmar, el pago se registra en la compra y genera el egreso de caja correspondiente. El cambio queda asentado en auditoria.
              </p>
            </div>

            <div className="modal-action">
              <button type="button" className="btn btn-ghost" disabled={savingPaymentId === paymentModalPurchase.id} onClick={closePaymentStatusModal}>Cancelar</button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={
                  savingPaymentId === paymentModalPurchase.id ||
                  (
                    draftPaymentStatus === (paymentStatuses[paymentModalPurchase.id] ?? paymentModalPurchase.paymentStatus) &&
                    !markProductsInStock &&
                    Number(paymentDraft.amount || 0) <= 0
                  )
                }
                onClick={() => updatePaymentStatus(paymentModalPurchase, draftPaymentStatus)}
              >
                {savingPaymentId === paymentModalPurchase.id ? "Actualizando..." : "Actualizar"}
              </button>
            </div>
          </div>
          <button type="button" className="modal-backdrop" aria-label="Cerrar" onClick={closePaymentStatusModal}>cerrar</button>
        </div>
      ) : null}
      <PurchaseTimelineModal purchaseId={timelinePurchaseId} onClose={() => setTimelinePurchaseId(null)} />
    </>
  )
}
