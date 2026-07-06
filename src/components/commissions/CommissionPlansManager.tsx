"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

type Plan = { id: string; name: string; base: string; ratePct: string | number; isActive: boolean }

export default function CommissionPlansManager({ plans }: { plans: Plan[] }) {
  const router = useRouter()
  const [form, setForm] = useState({ name: "", base: "SALE_PROFIT", ratePct: "" })
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setIsSaving(true)
    setError(null)
    const response = await fetch("/api/commission-plans", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) })
    setIsSaving(false)
    if (!response.ok) {
      const payload = await response.json().catch(() => null)
      setError(payload?.error ?? "No se pudo crear el plan")
      return
    }
    setForm({ name: "", base: "SALE_PROFIT", ratePct: "" })
    router.refresh()
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
      <div className="overflow-x-auto rounded-lg border border-base-300">
        <table className="table table-sm">
          <thead><tr><th>Plan</th><th>Base</th><th>%</th><th>Estado</th></tr></thead>
          <tbody>{plans.map((plan) => <tr key={plan.id}><td>{plan.name}</td><td>{plan.base}</td><td>{Number(plan.ratePct).toFixed(2)}%</td><td><span className={`badge badge-sm ${plan.isActive ? "badge-success" : "badge-ghost"}`}>{plan.isActive ? "Activo" : "Inactivo"}</span></td></tr>)}</tbody>
        </table>
      </div>
      <form onSubmit={submit} className="space-y-3 rounded-lg border border-base-300 p-4">
        <h2 className="font-semibold">Nuevo plan</h2>
        <label className="form-control"><span className="label-text">Nombre *</span><input required className="input input-bordered" value={form.name} onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))} /></label>
        <label className="form-control"><span className="label-text">Base</span><select className="select select-bordered" value={form.base} onChange={(event) => setForm((prev) => ({ ...prev, base: event.target.value }))}><option>SALE_PROFIT</option><option>SALE_TOTAL</option></select></label>
        <label className="form-control"><span className="label-text">Porcentaje *</span><input required type="number" step="0.01" className="input input-bordered" value={form.ratePct} onChange={(event) => setForm((prev) => ({ ...prev, ratePct: event.target.value }))} /></label>
        {error ? <div className="text-sm text-error">{error}</div> : null}
        <button className="btn btn-primary w-full" disabled={isSaving}>{isSaving ? "Guardando..." : "Crear plan"}</button>
      </form>
    </div>
  )
}
