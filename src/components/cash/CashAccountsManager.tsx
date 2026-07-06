"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

type Account = { id: string; code: string; name: string; type: string; currency: string; isActive: boolean }

export default function CashAccountsManager({ accounts }: { accounts: Account[] }) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [form, setForm] = useState({ code: "", name: "", type: "CASH", currency: "USD" })

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setIsSaving(true)
    setError(null)
    const response = await fetch("/api/cash-accounts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) })
    setIsSaving(false)
    if (!response.ok) {
      const payload = await response.json().catch(() => null)
      setError(payload?.error ?? "No se pudo crear la cuenta")
      return
    }
    setForm({ code: "", name: "", type: "CASH", currency: "USD" })
    router.refresh()
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
      <div className="overflow-x-auto rounded-lg border border-base-300">
        <table className="table table-sm">
          <thead><tr><th>Cuenta</th><th>Codigo</th><th>Tipo</th><th>Moneda</th><th>Estado</th></tr></thead>
          <tbody>{accounts.map((account) => <tr key={account.id}><td>{account.name}</td><td>{account.code}</td><td>{account.type}</td><td>{account.currency}</td><td><span className={`badge badge-sm ${account.isActive ? "badge-success" : "badge-ghost"}`}>{account.isActive ? "Activa" : "Inactiva"}</span></td></tr>)}</tbody>
        </table>
      </div>
      <form onSubmit={submit} className="rounded-lg border border-base-300 p-4 space-y-3">
        <h2 className="font-semibold">Nueva cuenta</h2>
        <label className="form-control"><span className="label-text">Codigo *</span><input required className="input input-bordered" value={form.code} onChange={(event) => setForm((prev) => ({ ...prev, code: event.target.value }))} /></label>
        <label className="form-control"><span className="label-text">Nombre *</span><input required className="input input-bordered" value={form.name} onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))} /></label>
        <label className="form-control"><span className="label-text">Tipo</span><select className="select select-bordered" value={form.type} onChange={(event) => setForm((prev) => ({ ...prev, type: event.target.value }))}><option>CASH</option><option>BANK</option><option>DIGITAL_WALLET</option><option>CRYPTO</option><option>OTHER</option></select></label>
        <label className="form-control"><span className="label-text">Moneda</span><select className="select select-bordered" value={form.currency} onChange={(event) => setForm((prev) => ({ ...prev, currency: event.target.value }))}><option>USD</option><option>ARS</option><option>USDT</option></select></label>
        {error ? <div className="text-sm text-error">{error}</div> : null}
        <button className="btn btn-primary w-full" disabled={isSaving}>{isSaving ? "Guardando..." : "Crear cuenta"}</button>
      </form>
    </div>
  )
}
