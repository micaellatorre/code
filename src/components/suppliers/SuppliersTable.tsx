"use client"

import Link from "next/link"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { EyeIcon, PencilIcon, TrashIcon } from "@heroicons/react/24/outline"
import { formatInTimeZone } from "date-fns-tz"
import { AR_TIME_ZONE } from "@/lib/timezone"
import SupplierDetailsModal from "./SupplierDetailsModal"
import type { SupplierDetail, SupplierListItem } from "./types"

type Props = {
  suppliers: SupplierListItem[]
}

export default function SuppliersTable({ suppliers }: Props) {
  const router = useRouter()
  const [detail, setDetail] = useState<SupplierDetail | null>(null)
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<SupplierListItem | null>(null)
  const [deleting, setDeleting] = useState(false)

  async function openDetail(supplierId: string) {
    setLoadingId(supplierId)
    setError(null)
    try {
      const response = await fetch(`/api/suppliers/${supplierId}`)
      const payload = await response.json().catch(() => null)
      if (!response.ok) throw new Error(payload?.error ?? "No se pudo cargar el proveedor")
      setDetail(payload as SupplierDetail)
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cargar el proveedor")
    } finally {
      setLoadingId(null)
    }
  }

  async function deleteSupplier() {
    if (!deleteTarget) return
    setDeleting(true)
    setError(null)
    try {
      const response = await fetch(`/api/suppliers/${deleteTarget.id}`, { method: "DELETE" })
      const payload = await response.json().catch(() => null)
      if (!response.ok) throw new Error(payload?.error ?? "No se pudo eliminar el proveedor")
      setDeleteTarget(null)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo eliminar el proveedor")
    } finally {
      setDeleting(false)
    }
  }

  return (
    <>
      {error ? <div className="alert alert-error mb-3 text-sm">{error}</div> : null}
      <div className="overflow-x-auto rounded-box border border-base-content/5 bg-base-100">
        <table className="table table-zebra w-full">
          <thead>
            <tr>
              <th>Proveedor</th>
              <th>Contacto</th>
              <th>Ubicacion</th>
              <th>Sucursal principal</th>
              <th>Coberturas</th>
              <th>Compras</th>
              <th>Ultima compra</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {suppliers.map((supplier) => {
              const extra = Math.max(0, supplier.branchCoverages.length - 2)
              return (
                <tr key={supplier.id}>
                  <td>
                    <div className="font-medium">{supplier.name}</div>
                    {supplier.email ? <div className="text-xs text-base-content/60">{supplier.email}</div> : null}
                  </td>
                  <td>
                    <div>{supplier.contactName ?? "-"}</div>
                    <div className="text-xs text-base-content/60">{supplier.phone ?? ""}</div>
                  </td>
                  <td>{[supplier.city, supplier.provinceRef?.name].filter(Boolean).join(", ") || "-"}</td>
                  <td>
                    <span className={`badge ${supplier.branch ? "badge-primary badge-outline" : "badge-ghost"}`}>
                      {supplier.branch?.name ?? "Sin sucursal asignada"}
                    </span>
                  </td>
                  <td>
                    <div className="flex flex-wrap gap-1">
                      {supplier.branchCoverages.slice(0, 2).map((branch) => (
                        <span key={branch.id} className="badge badge-outline">{branch.name}</span>
                      ))}
                      {extra ? <span className="badge badge-ghost">+{extra} mas</span> : null}
                      {!supplier.branchCoverages.length ? <span className="text-sm text-base-content/50">-</span> : null}
                    </div>
                  </td>
                  <td>{supplier.purchasesCount}</td>
                  <td>{supplier.lastPurchaseAt ? formatInTimeZone(new Date(supplier.lastPurchaseAt), AR_TIME_ZONE, "dd/MM/yyyy") : "-"}</td>
                  <td>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        className="btn btn-square btn-ghost btn-xs"
                        title="Ver detalles"
                        aria-label="Ver detalles del proveedor"
                        onClick={() => openDetail(supplier.id)}
                      >
                        {loadingId === supplier.id ? <span className="loading loading-spinner loading-xs" /> : <EyeIcon className="size-4" />}
                      </button>
                      <Link href={`/dashboard/suppliers/${supplier.id}/edit`} className="btn btn-square btn-ghost btn-xs" title="Editar">
                        <PencilIcon className="size-4" />
                      </Link>
                      <button
                        type="button"
                        className="btn btn-square btn-ghost btn-xs text-error"
                        title="Eliminar"
                        aria-label="Eliminar proveedor"
                        onClick={() => setDeleteTarget(supplier)}
                      >
                        <TrashIcon className="size-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
            {!suppliers.length ? (
              <tr><td colSpan={8} className="py-8 text-center text-base-content/60">No hay proveedores para los filtros seleccionados.</td></tr>
            ) : null}
          </tbody>
        </table>
      </div>
      <SupplierDetailsModal
        supplier={detail}
        loading={Boolean(loadingId && !detail)}
        error={error}
        onClose={() => {
          setDetail(null)
          setError(null)
        }}
      />
      {deleteTarget ? (
        <dialog className="modal modal-open" onCancel={() => !deleting && setDeleteTarget(null)}>
          <div className="modal-box max-w-lg rounded-lg">
            <h2 className="text-xl font-semibold">Eliminar proveedor</h2>
            <p className="mt-2 text-sm leading-6 text-base-content/70">
              Vas a eliminar <span className="font-semibold">{deleteTarget.name}</span>. Si tiene compras asociadas, el backend va a bloquear la operacion para preservar el historial.
            </p>
            <div className="modal-action">
              <button type="button" className="btn btn-ghost" onClick={() => setDeleteTarget(null)} disabled={deleting}>Cancelar</button>
              <button type="button" className="btn btn-error" onClick={deleteSupplier} disabled={deleting}>
                {deleting ? <span className="loading loading-spinner loading-xs" /> : null}
                Eliminar
              </button>
            </div>
          </div>
          <form method="dialog" className="modal-backdrop">
            <button onClick={() => !deleting && setDeleteTarget(null)}>cerrar</button>
          </form>
        </dialog>
      ) : null}
    </>
  )
}
