"use client"

import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"

type Account = { id: string; name: string; code: string; currency: string; scope?: string; branch?: { name: string } | null }

type CashMovementFormProps = {
  formId?: string
  hideActions?: boolean
  onSuccess?: () => void
  onCancel?: () => void
  onSubmittingChange?: (submitting: boolean) => void
}

export default function CashMovementForm({ formId, hideActions = false, onSuccess, onCancel, onSubmittingChange }: CashMovementFormProps = {}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [accounts, setAccounts] = useState<Account[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [form, setForm] = useState({ accountId: "", direction: "INCOME", category: "ADJUSTMENT", detail: "", amount: "", currency: "USD", exchangeRate: "" })

  useEffect(() => {
    fetch("/api/cash-accounts").then((res) => res.ok ? res.json() : null).then((data) => setAccounts(data?.accounts ?? []))
  }, [])

  useEffect(() => {
    const accountId = searchParams.get("accountId")
    const direction = searchParams.get("direction")
    const category = searchParams.get("category")
    const detail = searchParams.get("detail")
    const amount = searchParams.get("amount")
    const currency = searchParams.get("currency")
    const exchangeRate = searchParams.get("exchangeRate")
    if (!accountId && !direction && !category && !detail && !amount && !currency && !exchangeRate) return
    setForm((prev) => ({
      ...prev,
      accountId: accountId || prev.accountId,
      direction: direction === "EXPENSE" ? "EXPENSE" : "INCOME",
      category: category && ["ADJUSTMENT", "EXPENSE", "SERVICE_PAYMENT", "COMMISSION_PAYMENT"].includes(category) ? category : "ADJUSTMENT",
      detail: detail || prev.detail,
      amount: amount || prev.amount,
      currency: currency && ["USD", "ARS", "USDT"].includes(currency) ? currency : prev.currency,
      exchangeRate: exchangeRate || "",
    }))
  }, [searchParams])

  useEffect(() => {
    onSubmittingChange?.(isSaving)
  }, [isSaving, onSubmittingChange])

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setIsSaving(true)
    setError(null)
    const response = await fetch("/api/cash-movements", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, exchangeRate: form.exchangeRate || null }) })
    setIsSaving(false)
    if (!response.ok) {
      const payload = await response.json().catch(() => null)
      setError(payload?.error ?? "No se pudo registrar el movimiento")
      return
    }
    if (onSuccess) {
      onSuccess()
    } else {
      router.push("/dashboard/cash")
      router.refresh()
    }
  }

  function selectAccount(accountId: string) {
    const account = accounts.find((item) => item.id === accountId)
    setForm((prev) => ({ ...prev, accountId, currency: account?.currency ?? prev.currency }))
  }

  return (
    <form id={formId} onSubmit={submit} className="mx-auto max-w-2xl space-y-4">
      <div className="grid gap-3 md:grid-cols-2">
        <label className="form-control"><span className="label-text">Cuenta *</span><select required className="select select-bordered" value={form.accountId} onChange={(event) => selectAccount(event.target.value)}><option value="">Seleccionar</option>{accounts.map((account) => <option key={account.id} value={account.id}>{account.name} ({account.currency})</option>)}</select></label>
        <label className="form-control"><span className="label-text">Tipo *</span><select className="select select-bordered" value={form.direction} onChange={(event) => setForm((prev) => ({ ...prev, direction: event.target.value }))}><option value="INCOME">Ingreso</option><option value="EXPENSE">Egreso</option></select></label>
        <label className="form-control"><span className="label-text">Categoria</span><select className="select select-bordered" value={form.category} onChange={(event) => setForm((prev) => ({ ...prev, category: event.target.value }))}><option value="ADJUSTMENT">Ajuste</option><option value="EXPENSE">Gasto</option><option value="SERVICE_PAYMENT">Servicio tecnico</option><option value="COMMISSION_PAYMENT">Comision</option></select></label>
        <label className="form-control"><span className="label-text">Moneda</span><input readOnly className="input input-bordered bg-base-200" value={form.currency} /></label>
        <label className="form-control"><span className="label-text">Monto *</span><input required type="number" step="0.01" className="input input-bordered" value={form.amount} onChange={(event) => setForm((prev) => ({ ...prev, amount: event.target.value }))} /></label>
        <label className="form-control"><span className="label-text">Tipo de cambio</span><input type="number" step="0.01" className="input input-bordered" value={form.exchangeRate} onChange={(event) => setForm((prev) => ({ ...prev, exchangeRate: event.target.value }))} /></label>
        <label className="form-control md:col-span-2"><span className="label-text">Detalle *</span><textarea required className="textarea textarea-bordered" value={form.detail} onChange={(event) => setForm((prev) => ({ ...prev, detail: event.target.value }))} /></label>
      </div>
      {error ? <div className="alert alert-error text-sm">{error}</div> : null}
      {!hideActions ? (
        <div className="flex justify-end gap-2"><button type="button" className="btn btn-ghost" onClick={onCancel ?? (() => router.back())} disabled={isSaving}>Volver</button><button className="btn btn-primary" disabled={isSaving}>{isSaving ? "Registrando..." : "Registrar movimiento"}</button></div>
      ) : null}
    </form>
  )
}
