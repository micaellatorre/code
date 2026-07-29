"use client"

import { useEffect, useState } from "react"
import type { FormEvent } from "react"
import { useRouter } from "next/navigation"
import { EnvelopeIcon } from "@heroicons/react/24/outline"
import UserBranchAdmin from "@/components/users/UserBranchAdmin"
import UsersTopSellersTable from "@/components/users/UsersTopSellersTable"
import type { UsersDashboardData } from "@/lib/domain/users-dashboard"

type InviteForm = {
  name: string
  email: string
  role: "ADMIN" | "VENDEDOR" | "STOCK" | "SOCIO"
  branchId: string
  isAdmin: boolean
  lastNonAdminRole: "VENDEDOR" | "STOCK" | "SOCIO"
}

const nonAdminRoles = ["VENDEDOR", "STOCK", "SOCIO"] as const

export default function TeamTab({
  team,
  inviteNonce,
}: {
  team: UsersDashboardData
  inviteNonce: number
}) {
  const router = useRouter()
  const [viewMode, setViewMode] = useState<"table" | "cards">("table")
  const [inviteOpen, setInviteOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [form, setForm] = useState<InviteForm>({
    name: "",
    email: "",
    role: "VENDEDOR",
    branchId: team.branches[0]?.id ?? "",
    isAdmin: false,
    lastNonAdminRole: "VENDEDOR",
  })

  useEffect(() => {
    if (inviteNonce > 0) setInviteOpen(true)
  }, [inviteNonce])

  function showToast(message: string) {
    setToast(message)
    window.setTimeout(() => setToast(null), 3000)
  }

  function setAdmin(value: boolean) {
    setForm((prev) => ({
      ...prev,
      isAdmin: value,
      role: value ? "ADMIN" : prev.lastNonAdminRole,
    }))
  }

  function setRole(role: InviteForm["role"]) {
    setForm((prev) => ({
      ...prev,
      role,
      isAdmin: role === "ADMIN",
      lastNonAdminRole: role === "ADMIN" ? prev.lastNonAdminRole : role,
    }))
  }

  async function invite(event: FormEvent) {
    event.preventDefault()
    setSaving(true)
    setError(null)
    const response = await fetch("/api/config/team/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name,
        email: form.email,
        role: form.role,
        branchId: form.branchId,
      }),
    })
    const body = await response.json().catch(() => null)
    setSaving(false)
    if (!response.ok) {
      setError(body?.error ?? "No se pudo generar invitacion")
      return
    }
    setInviteOpen(false)
    setForm((prev) => ({ ...prev, name: "", email: "", role: "VENDEDOR", isAdmin: false, lastNonAdminRole: "VENDEDOR" }))
    router.refresh()
    showToast("Invitacion generada")
  }

  return (
    <div className="space-y-4">
      {toast ? (
        <div className="toast toast-top toast-end z-[120]">
          <div className="alert alert-success text-sm shadow-lg"><span>{toast}</span></div>
        </div>
      ) : null}
      {error ? <div className="alert alert-error py-3 text-sm">{error}</div> : null}

      <div className="flex justify-end">
        <div className="join">
          <button type="button" className={`btn btn-sm join-item ${viewMode === "table" ? "btn-primary" : "btn-outline"}`} onClick={() => setViewMode("table")}>
            Tabla
          </button>
          <button type="button" className={`btn btn-sm join-item ${viewMode === "cards" ? "btn-primary" : "btn-outline"}`} onClick={() => setViewMode("cards")}>
            Cards
          </button>
        </div>
      </div>

      <UserBranchAdmin
        branches={team.branches}
        hasCommissionPlans={team.hasCommissionPlans}
        users={team.users}
        displayMode={viewMode}
      />
      <UsersTopSellersTable rows={team.sellerScoreRows} />

      {inviteOpen ? (
        <dialog className="modal modal-open">
          <form onSubmit={invite} className="modal-box max-w-xl rounded-lg">
            <h3 className="text-lg font-semibold">Generar invitacion</h3>
            <div className="mt-4 grid gap-3">
              <label className="form-control">
                <span className="label-text">Nombre completo</span>
                <input className="input input-bordered" value={form.name} onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))} required />
              </label>
              <label className="form-control">
                <span className="label-text">Email</span>
                <input type="email" className="input input-bordered" value={form.email} onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))} required />
              </label>
              <label className="flex items-center justify-between gap-3 rounded-lg border border-base-300 p-3">
                <span>Administrador</span>
                <input type="checkbox" className="toggle toggle-primary" checked={form.isAdmin} onChange={(event) => setAdmin(event.target.checked)} />
              </label>
              {!form.isAdmin ? (
                <div className="join">
                  {nonAdminRoles.map((role) => (
                    <button key={role} type="button" className={`btn btn-sm join-item ${form.role === role ? "btn-primary" : "btn-outline"}`} onClick={() => setRole(role)}>
                      {role}
                    </button>
                  ))}
                </div>
              ) : null}
              <label className="form-control">
                <span className="label-text">Sucursal</span>
                <select className="select select-bordered" value={form.branchId} onChange={(event) => setForm((prev) => ({ ...prev, branchId: event.target.value }))} required>
                  {team.branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
                </select>
              </label>
            </div>
            <div className="modal-action">
              <button type="button" className="btn btn-ghost" onClick={() => setInviteOpen(false)} disabled={saving}>Cerrar</button>
              <button type="submit" className="btn btn-primary" disabled={saving || !form.branchId}>
                {saving ? <span className="loading loading-spinner loading-xs" /> : <EnvelopeIcon className="size-4" />}
                Generar invitacion
              </button>
            </div>
          </form>
        </dialog>
      ) : null}
    </div>
  )
}
