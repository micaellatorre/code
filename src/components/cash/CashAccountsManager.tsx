"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"

type Branch = { id: string; code: string; name: string }
type Account = {
  id: string
  code: string
  name: string
  type: string
  currency: string
  scope: string
  branchId?: string | null
  branch?: Branch | null
  sortOrder: number
  isActive: boolean
}

const emptyForm = {
  code: "",
  name: "",
  type: "CASH",
  currency: "USD",
  scope: "TENANT",
  branchId: "",
  sortOrder: "0",
  isActive: true,
}

export default function CashAccountsManager({ accounts, isAdmin }: { accounts: Account[]; isAdmin: boolean }) {
  const router = useRouter()
  const [branches, setBranches] = useState<Branch[]>([])
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [form, setForm] = useState(emptyForm)

  useEffect(() => {
    fetch("/api/users/me/branches", { cache: "no-store" })
      .then((res) => res.ok ? res.json() : null)
      .then((payload) => setBranches(payload?.branches ?? []))
      .catch(() => setBranches([]))
  }, [])

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setIsSaving(true)
    setError(null)
    setSuccess(null)
    const response = await fetch("/api/cash-accounts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        branchId: form.scope === "BRANCH" ? form.branchId : null,
        sortOrder: Number(form.sortOrder || 0),
      }),
    })
    setIsSaving(false)
    if (!response.ok) {
      const payload = await response.json().catch(() => null)
      setError(payload?.error ?? "No se pudo crear la cuenta")
      return
    }
    setForm(emptyForm)
    setSuccess("Cuenta creada.")
    router.refresh()
  }

  async function toggleActive(account: Account) {
    setError(null)
    setSuccess(null)
    const response = await fetch(`/api/cash-accounts/${account.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !account.isActive }),
    })
    const payload = await response.json().catch(() => null)
    if (!response.ok) {
      setError(payload?.error ?? "No se pudo actualizar la cuenta")
      return
    }
    setSuccess("Cuenta actualizada.")
    router.refresh()
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
      <div className="overflow-x-auto rounded-lg border border-base-300 bg-base-100">
        <table className="table table-sm">
          <thead><tr><th>Cuenta</th><th>Codigo</th><th>Tipo</th><th>Moneda</th><th>Alcance</th><th>Orden</th><th>Estado</th><th /></tr></thead>
          <tbody>
            {accounts.map((account) => (
              <tr key={account.id}>
                <td className="font-medium">{account.name}</td>
                <td>{account.code}</td>
                <td>{account.type}</td>
                <td>{account.currency}</td>
                <td>{account.scope === "BRANCH" ? account.branch?.name ?? "Sucursal" : "Global del tenant"}</td>
                <td>{account.sortOrder}</td>
                <td><span className={`badge badge-sm ${account.isActive ? "badge-success" : "badge-ghost"}`}>{account.isActive ? "Activa" : "Inactiva"}</span></td>
                <td className="text-right">{isAdmin ? <button type="button" className="btn btn-ghost btn-xs" onClick={() => toggleActive(account)}>{account.isActive ? "Desactivar" : "Activar"}</button> : null}</td>
              </tr>
            ))}
            {!accounts.length ? <tr><td colSpan={8} className="py-8 text-center text-base-content/60">Sin cajas configuradas</td></tr> : null}
          </tbody>
        </table>
      </div>

      {isAdmin ? <form onSubmit={submit} className="rounded-lg border border-base-300 bg-base-100 p-4 space-y-3">
        <h2 className="font-semibold">Nueva cuenta</h2>
        <label className="form-control"><span className="label-text">Codigo *</span><input required className="input input-bordered" value={form.code} onChange={(event) => setForm((prev) => ({ ...prev, code: event.target.value }))} /></label>
        <label className="form-control"><span className="label-text">Nombre *</span><input required className="input input-bordered" value={form.name} onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))} /></label>
        <label className="form-control"><span className="label-text">Tipo</span><select className="select select-bordered" value={form.type} onChange={(event) => setForm((prev) => ({ ...prev, type: event.target.value }))}><option>CASH</option><option>BANK</option><option>DIGITAL_WALLET</option><option>CRYPTO</option><option>OTHER</option></select></label>
        <label className="form-control"><span className="label-text">Moneda</span><select className="select select-bordered" value={form.currency} onChange={(event) => setForm((prev) => ({ ...prev, currency: event.target.value }))}><option>USD</option><option>ARS</option><option>USDT</option></select></label>
        <label className="form-control"><span className="label-text">Alcance</span><select className="select select-bordered" value={form.scope} onChange={(event) => setForm((prev) => ({ ...prev, scope: event.target.value, branchId: "" }))}><option value="TENANT">Global del tenant</option><option value="BRANCH">Sucursal</option></select></label>
        {form.scope === "BRANCH" ? (
          <label className="form-control"><span className="label-text">Sucursal *</span><select required className="select select-bordered" value={form.branchId} onChange={(event) => setForm((prev) => ({ ...prev, branchId: event.target.value }))}><option value="">Seleccionar</option>{branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select></label>
        ) : null}
        <label className="form-control"><span className="label-text">Orden visual</span><input type="number" min={0} className="input input-bordered" value={form.sortOrder} onChange={(event) => setForm((prev) => ({ ...prev, sortOrder: event.target.value }))} /></label>
        <label className="flex cursor-pointer items-center gap-2 text-sm"><input type="checkbox" className="checkbox checkbox-sm" checked={form.isActive} onChange={(event) => setForm((prev) => ({ ...prev, isActive: event.target.checked }))} />Activa</label>
        {error ? <div className="alert alert-error text-sm">{error}</div> : null}
        {success ? <div className="alert alert-success text-sm">{success}</div> : null}
        <button className="btn btn-primary w-full" disabled={isSaving}>{isSaving ? "Guardando..." : "Crear cuenta"}</button>
      </form> : null}
    </div>
  )
}
