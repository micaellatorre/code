"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { PencilSquareIcon, TrashIcon } from "@heroicons/react/24/outline"

type BranchRow = {
  id: string
  code: string
  name: string
  province: string | null
  provinceRef?: { name: string } | null
  provinceCoverages?: Array<{ province: { name: string } }>
  city: string | null
  address: string | null
  phone: string | null
  email: string | null
  isActive: boolean
  _count: { products: number; sales: number; purchases: number }
}

type Filter = "ALL" | "ACTIVE" | "INACTIVE"

export default function BranchesTable({ branches, canManage }: { branches: BranchRow[]; canManage: boolean }) {
  const router = useRouter()
  const [filter, setFilter] = useState<Filter>("ALL")
  const [message, setMessage] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const rows = useMemo(() => {
    if (filter === "ACTIVE") return branches.filter((branch) => branch.isActive)
    if (filter === "INACTIVE") return branches.filter((branch) => !branch.isActive)
    return branches
  }, [branches, filter])

  async function removeBranch(branch: BranchRow) {
    setDeletingId(branch.id)
    setMessage(null)
    const response = await fetch(`/api/branches/${branch.id}`, { method: "DELETE" })
    const payload = await response.json().catch(() => null)
    setDeletingId(null)

    if (!response.ok) {
      setMessage(payload?.error ?? "No se pudo eliminar la sucursal")
      return
    }

    setMessage(payload?.mode === "deactivated" ? "Sucursal desactivada por tener historial asociado." : "Sucursal eliminada.")
    router.refresh()
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="join">
          {(["ALL", "ACTIVE", "INACTIVE"] as const).map((item) => (
            <button key={item} type="button" className={`btn btn-sm join-item ${filter === item ? "btn-primary" : "btn-outline"}`} onClick={() => setFilter(item)}>
              {item === "ALL" ? "Todas" : item === "ACTIVE" ? "Activas" : "Inactivas"}
            </button>
          ))}
        </div>
        {canManage ? <Link href="/dashboard/branches/new" className="btn btn-primary btn-sm">+ Nueva sucursal</Link> : null}
      </div>
      {message ? <div className="alert alert-info py-2 text-sm">{message}</div> : null}
      <div className="overflow-x-auto rounded-lg border border-base-300 bg-base-100">
        <table className="table table-sm w-full">
          <thead>
            <tr>
              <th>Sucursal</th>
              <th>Codigo</th>
              <th>Ubicacion</th>
              <th>Contacto</th>
              <th className="text-right">Productos</th>
              <th className="text-right">Ventas</th>
              <th>Estado</th>
              {canManage ? <th>Acciones</th> : null}
            </tr>
          </thead>
          <tbody>
            {rows.map((branch) => (
              <tr key={branch.id}>
                <td>
                  <div className="font-medium">{branch.name}</div>
                  <div className="text-xs text-base-content/50">{branch.address || "Sin direccion"}</div>
                </td>
                <td>{branch.code}</td>
                <td>
                  <div>{[branch.city, branch.provinceRef?.name ?? branch.province].filter(Boolean).join(", ") || "-"}</div>
                  <div className="text-xs text-base-content/50">
                    {branch.provinceCoverages?.length ? `Cubre ${branch.provinceCoverages.length} provincias` : "Sin cobertura definida"}
                  </div>
                </td>
                <td>
                  <div>{branch.phone || "-"}</div>
                  <div className="text-xs text-base-content/50">{branch.email || "-"}</div>
                </td>
                <td className="text-right tabular-nums">{branch._count.products}</td>
                <td className="text-right tabular-nums">{branch._count.sales}</td>
                <td><span className={`badge badge-sm ${branch.isActive ? "badge-success" : "badge-ghost"}`}>{branch.isActive ? "Activa" : "Inactiva"}</span></td>
                {canManage ? (
                  <td>
                    <div className="flex gap-1">
                      <Link className="btn btn-ghost btn-xs" href={`/dashboard/branches/${branch.id}/edit`} title="Editar">
                        <PencilSquareIcon className="size-4" />
                      </Link>
                      <button type="button" className="btn btn-ghost btn-xs text-error" title="Eliminar o desactivar" disabled={deletingId === branch.id} onClick={() => removeBranch(branch)}>
                        {deletingId === branch.id ? <span className="loading loading-spinner loading-xs" /> : <TrashIcon className="size-4" />}
                      </button>
                    </div>
                  </td>
                ) : null}
              </tr>
            ))}
            {!rows.length ? (
              <tr>
                <td colSpan={canManage ? 8 : 7} className="py-10 text-center text-base-content/60">No hay sucursales para el filtro seleccionado.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  )
}
