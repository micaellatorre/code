"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import {
  MapPinIcon,
  ClipboardDocumentCheckIcon,
} from "@heroicons/react/24/outline"
import BranchAutocomplete, { type BranchOption } from "@/components/branches/BranchAutocomplete"

type UserRow = {
  id: string
  email: string
  name: string | null
  role: string
  isActive: boolean
  currentBranchId: string | null
  currentBranch: BranchOption | null
  coverageBranchIds: string[]
}

export default function UserBranchAdmin({
  users,
  branches,
  hasCommissionPlans = false,
}: {
  users: UserRow[]
  branches: BranchOption[]
  hasCommissionPlans?: boolean
}) {
  const router = useRouter()
  const [rows, setRows] = useState(users)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const editing = rows.find((row) => row.id === editingId) ?? null

  async function save(user: UserRow) {
    setSavingId(user.id)
    try {
      const response = await fetch(`/api/users/${user.id}/branches`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentBranchId: user.currentBranchId,
          coverageBranchIds: user.coverageBranchIds,
        }),
      })
      if (!response.ok) throw new Error(await response.text())
      setEditingId(null)
    } finally {
      setSavingId(null)
    }
  }

  function updateRow(userId: string, updater: (row: UserRow) => UserRow) {
    setRows((prev) => prev.map((row) => (row.id === userId ? updater(row) : row)))
  }

  function openCommissions(user: UserRow) {
    if (!hasCommissionPlans) {
      setToastMessage("No existe un plan de comision activo. Crea uno para este vendedor.")
      window.setTimeout(() => setToastMessage(null), 3200)
      window.setTimeout(() => router.push(`/dashboard/commissions/new?closerId=${encodeURIComponent(user.id)}`), 900)
      return
    }

    router.push(`/dashboard/commissions/${user.id}/edit`)
  }

  return (
    <div className="space-y-4">
      {toastMessage ? (
        <div className="toast toast-top toast-end z-[120]">
          <div className="alert alert-warning text-sm shadow-lg">
            <span>{toastMessage}</span>
          </div>
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-lg border border-base-300 bg-base-100">
        <table className="table table-sm w-full">
          <thead>
            <tr>
              <th>Usuario</th>
              <th>Rol</th>
              <th>Sucursal actual</th>
              <th>Cobertura</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((user) => (
              <tr key={user.id}>
                <td>
                  <div className="font-medium">{user.name ?? user.email}</div>
                  <div className="text-xs text-base-content/60">{user.email}</div>
                </td>
                <td><span className="badge badge-outline badge-sm">{user.role}</span></td>
                <td>{user.currentBranch?.name ?? branches.find((branch) => branch.id === user.currentBranchId)?.name ?? "-"}</td>
                <td>{user.role === "ADMIN" ? "Todas las sucursales" : coverageLabel(user.coverageBranchIds, branches)}</td>
                <td>{user.isActive ? <span className="badge badge-success badge-sm">Activo</span> : <span className="badge badge-ghost badge-sm">Inactivo</span>}</td>
                <td>
                  <div className="flex flex-wrap gap-2">
                    <Link href={`/dashboard/users/${user.id}/edit`} className="btn btn-ghost btn-xs">Editar</Link>
                    <button type="button" className="btn btn-outline btn-xs" onClick={() => setEditingId(user.id)}>Sucursales
                      <MapPinIcon className="h-4 w-4" />
                    </button>
                    {user.role === "VENDEDOR" ? (
                      <button type="button" className="btn btn-outline btn-xs" onClick={() => openCommissions(user)}>
                        Comision
                        <ClipboardDocumentCheckIcon className="h-4 w-4" />
                      </button>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing ? (
        <dialog className="modal modal-open">
          <div className="modal-box max-w-3xl rounded-lg">
            <h2 className="text-xl font-semibold">Sucursales de {editing.name ?? editing.email}</h2>
            {editing.role === "ADMIN" ? (
              <div className="alert alert-info mt-4 text-sm">
                Los administradores tienen cobertura automatica sobre todas las sucursales del tenant.
              </div>
            ) : (
              <UserCoverageEditor user={editing} branches={branches} updateRow={updateRow} />
            )}
            <div className="modal-action">
              <button type="button" className="btn btn-ghost" onClick={() => setEditingId(null)}>Cerrar</button>
              <button type="button" className="btn btn-primary" disabled={savingId === editing.id} onClick={() => save(editing)}>
                {savingId === editing.id ? <span className="loading loading-spinner loading-xs" /> : null}
                Guardar
              </button>
            </div>
          </div>
        </dialog>
      ) : null}
    </div>
  )
}

function coverageLabel(ids: string[], branches: BranchOption[]) {
  const names = ids.map((id) => branches.find((branch) => branch.id === id)?.name).filter(Boolean)
  return names.length ? names.join(" / ") : "Sin cobertura"
}

function UserCoverageEditor({
  user,
  branches,
  updateRow,
}: {
  user: UserRow
  branches: BranchOption[]
  updateRow: (userId: string, updater: (row: UserRow) => UserRow) => void
}) {
  const coverage = useMemo(() => new Set(user.coverageBranchIds), [user.coverageBranchIds])
  const selectableCurrentBranches = branches.filter((branch) => coverage.has(branch.id))

  function toggle(branchId: string) {
    updateRow(user.id, (row) => {
      const next = new Set(row.coverageBranchIds)
      if (next.has(branchId)) next.delete(branchId)
      else next.add(branchId)
      const ids = Array.from(next)
      const currentBranchId = row.currentBranchId && ids.includes(row.currentBranchId) ? row.currentBranchId : ids[0] ?? null
      return { ...row, coverageBranchIds: ids, currentBranchId }
    })
  }

  return (
    <div className="mt-4 space-y-4">
      <div>
        <h3 className="font-semibold">Sucursales de cobertura</h3>
        <p className="text-sm text-base-content/60">El usuario podra seleccionar estas sucursales como contexto operativo.</p>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {branches.map((branch) => (
          <label key={branch.id} className="flex cursor-pointer items-center gap-2 rounded-lg border border-base-300 p-2 text-sm">
            <input type="checkbox" className="checkbox checkbox-sm" checked={coverage.has(branch.id)} onChange={() => toggle(branch.id)} />
            <span>{branch.name}</span>
          </label>
        ))}
      </div>
      <BranchAutocomplete
        value={user.currentBranchId}
        branches={selectableCurrentBranches}
        onChange={(branchId) => updateRow(user.id, (row) => ({ ...row, currentBranchId: branchId }))}
        placeholder="Sucursal actual"
      />
    </div>
  )
}
