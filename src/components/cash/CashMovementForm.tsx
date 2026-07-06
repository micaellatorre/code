"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"

type Account = { id: string; name: string; code: string; currency: string }

export default function CashMovementForm() {
  const router = useRouter()
  const [accounts, setAccounts] = useState<Account[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [form, setForm] = useState({ accountId: "", direction: "INCOME", category: "ADJUSTMENT", detail: "", amount: "", currency: "USD", exchangeRate: "" })

  useEffect(() => {
    fetch("/api/cash-accounts").then((res) => res.ok ? res.json() : null).then((data) => setAccounts(data?.accounts ?? []))
  }, [])

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
    router.push("/dashboard/database?tab=cash")
    router.refresh()
  }

  return (
    <form onSubmit={submit} className="mx-auto max-w-2xl space-y-4">
      <div className="grid gap-3 md:grid-cols-2">
        <label className="form-control"><span className="label-text">Cuenta *</span><select required className="select select-bordered" value={form.accountId} onChange={(event) => setForm((prev) => ({ ...prev, accountId: event.target.value }))}><option value="">Seleccionar</option>{accounts.map((account) => <option key={account.id} value={account.id}>{account.name} ({account.currency})</option>)}</select></label>
        <label className="form-control"><span className="label-text">Tipo *</span><select className="select select-bordered" value={form.direction} onChange={(event) => setForm((prev) => ({ ...prev, direction: event.target.value }))}><option value="INCOME">Ingreso</option><option value="EXPENSE">Egreso</option></select></label>
        <label className="form-control"><span className="label-text">Categoria</span><select className="select select-bordered" value={form.category} onChange={(event) => setForm((prev) => ({ ...prev, category: event.target.value }))}><option>ADJUSTMENT</option><option>EXPENSE</option><option>SERVICE_PAYMENT</option><option>COMMISSION_PAYMENT</option></select></label>
        <label className="form-control"><span className="label-text">Moneda</span><select className="select select-bordered" value={form.currency} onChange={(event) => setForm((prev) => ({ ...prev, currency: event.target.value }))}><option>USD</option><option>ARS</option><option>USDT</option></select></label>
        <label className="form-control"><span className="label-text">Monto *</span><input required type="number" step="0.01" className="input input-bordered" value={form.amount} onChange={(event) => setForm((prev) => ({ ...prev, amount: event.target.value }))} /></label>
        <label className="form-control"><span className="label-text">Tipo de cambio</span><input type="number" step="0.01" className="input input-bordered" value={form.exchangeRate} onChange={(event) => setForm((prev) => ({ ...prev, exchangeRate: event.target.value }))} /></label>
        <label className="form-control md:col-span-2"><span className="label-text">Detalle *</span><textarea required className="textarea textarea-bordered" value={form.detail} onChange={(event) => setForm((prev) => ({ ...prev, detail: event.target.value }))} /></label>
      </div>
      {error ? <div className="alert alert-error text-sm">{error}</div> : null}
      <div className="flex justify-end gap-2"><button type="button" className="btn btn-ghost" onClick={() => router.back()} disabled={isSaving}>Volver</button><button className="btn btn-primary" disabled={isSaving}>{isSaving ? "Registrando..." : "Registrar movimiento"}</button></div>
    </form>
  )
}
