"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"

type Account = { id: string; name: string; currency: string }

export default function CashTransferForm() {
  const router = useRouter()
  const [accounts, setAccounts] = useState<Account[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [form, setForm] = useState({ fromAccountId: "", toAccountId: "", fromAmount: "", toAmount: "", exchangeRate: "", detail: "" })

  useEffect(() => {
    fetch("/api/cash-accounts").then((res) => res.ok ? res.json() : null).then((data) => setAccounts(data?.accounts ?? []))
  }, [])

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setIsSaving(true)
    setError(null)
    const response = await fetch("/api/cash-transfers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, exchangeRate: form.exchangeRate || null }) })
    setIsSaving(false)
    if (!response.ok) {
      const payload = await response.json().catch(() => null)
      setError(payload?.error ?? "No se pudo registrar la conversion")
      return
    }
    router.push("/dashboard/database?tab=cash")
    router.refresh()
  }

  return (
    <form onSubmit={submit} className="mx-auto max-w-2xl space-y-4">
      <div className="grid gap-3 md:grid-cols-2">
        <label className="form-control"><span className="label-text">Cuenta origen *</span><select required className="select select-bordered" value={form.fromAccountId} onChange={(event) => setForm((prev) => ({ ...prev, fromAccountId: event.target.value }))}><option value="">Seleccionar</option>{accounts.map((a) => <option key={a.id} value={a.id}>{a.name} ({a.currency})</option>)}</select></label>
        <label className="form-control"><span className="label-text">Cuenta destino *</span><select required className="select select-bordered" value={form.toAccountId} onChange={(event) => setForm((prev) => ({ ...prev, toAccountId: event.target.value }))}><option value="">Seleccionar</option>{accounts.map((a) => <option key={a.id} value={a.id}>{a.name} ({a.currency})</option>)}</select></label>
        <label className="form-control"><span className="label-text">Monto origen *</span><input required type="number" step="0.01" className="input input-bordered" value={form.fromAmount} onChange={(event) => setForm((prev) => ({ ...prev, fromAmount: event.target.value }))} /></label>
        <label className="form-control"><span className="label-text">Monto destino *</span><input required type="number" step="0.01" className="input input-bordered" value={form.toAmount} onChange={(event) => setForm((prev) => ({ ...prev, toAmount: event.target.value }))} /></label>
        <label className="form-control"><span className="label-text">Tipo de cambio</span><input type="number" step="0.01" className="input input-bordered" value={form.exchangeRate} onChange={(event) => setForm((prev) => ({ ...prev, exchangeRate: event.target.value }))} /></label>
        <label className="form-control"><span className="label-text">Detalle</span><input className="input input-bordered" value={form.detail} onChange={(event) => setForm((prev) => ({ ...prev, detail: event.target.value }))} /></label>
      </div>
      {error ? <div className="alert alert-error text-sm">{error}</div> : null}
      <div className="flex justify-end gap-2"><button type="button" className="btn btn-ghost" onClick={() => router.back()} disabled={isSaving}>Volver</button><button className="btn btn-primary" disabled={isSaving}>{isSaving ? "Convirtiendo..." : "Registrar conversion"}</button></div>
    </form>
  )
}
