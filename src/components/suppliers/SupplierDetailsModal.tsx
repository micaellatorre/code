"use client"

import { useEffect, useRef } from "react"
import { formatInTimeZone } from "date-fns-tz"
import { AR_TIME_ZONE } from "@/lib/timezone"
import type { SupplierDetail } from "./types"

type Props = {
  supplier: SupplierDetail | null
  loading?: boolean
  error?: string | null
  onClose: () => void
}

export default function SupplierDetailsModal({ supplier, loading, error, onClose }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if ((supplier || loading || error) && !dialog.open) dialog.showModal()
    if (!supplier && !loading && !error && dialog.open) dialog.close()
  }, [supplier, loading, error])

  return (
    <dialog ref={dialogRef} className="modal" onCancel={onClose}>
      <div className="modal-box max-w-2xl rounded-lg">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold">{supplier?.name ?? "Proveedor"}</h2>
            <p className="text-sm text-base-content/60">Detalle operativo y compras recientes</p>
          </div>
          <button type="button" className="btn btn-square btn-ghost btn-sm" onClick={onClose} aria-label="Cerrar">x</button>
        </div>

        {loading ? <div className="mt-6 h-36 animate-pulse rounded bg-base-200" /> : null}
        {error ? <div className="alert alert-error mt-4 text-sm">{error}</div> : null}

        {supplier ? (
          <div className="mt-5 space-y-5">
            <dl className="grid gap-3 sm:grid-cols-2">
              <div><dt className="text-xs uppercase text-base-content/50">Contacto</dt><dd>{supplier.contactName || "-"}</dd></div>
              <div><dt className="text-xs uppercase text-base-content/50">Telefono</dt><dd>{supplier.phone || "-"}</dd></div>
              <div><dt className="text-xs uppercase text-base-content/50">Email</dt><dd>{supplier.email || "-"}</dd></div>
              <div><dt className="text-xs uppercase text-base-content/50">Ubicacion</dt><dd>{[supplier.city, supplier.provinceRef?.name].filter(Boolean).join(", ") || "-"}</dd></div>
              <div><dt className="text-xs uppercase text-base-content/50">Direccion</dt><dd>{[supplier.addressStreet, supplier.addressNumber].filter(Boolean).join(" ") || "-"}</dd></div>
              <div><dt className="text-xs uppercase text-base-content/50">Sucursal principal</dt><dd>{supplier.branch?.name ?? "Sin sucursal asignada"}</dd></div>
            </dl>

            <section>
              <h3 className="font-semibold">Coberturas</h3>
              <div className="mt-2 flex flex-wrap gap-2">
                {supplier.branchCoverages.length ? supplier.branchCoverages.map((branch) => (
                  <span key={branch.id} className="badge badge-outline">{branch.name}</span>
                )) : <span className="text-sm text-base-content/60">Sin cobertura adicional</span>}
              </div>
            </section>

            <section>
              <h3 className="font-semibold">Ultimas compras</h3>
              {supplier.recentPurchases.length ? (
                <div className="mt-2 divide-y divide-base-300 rounded border border-base-300">
                  {supplier.recentPurchases.map((purchase) => (
                    <div key={purchase.id} className="grid gap-1 p-3 text-sm sm:grid-cols-[120px_1fr_auto]">
                      <span>{formatInTimeZone(new Date(purchase.date), AR_TIME_ZONE, "dd/MM/yyyy")}</span>
                      <span>{purchase.items.map((item) => `${item.modelName} x${item.units}`).join(", ") || "Sin items"}</span>
                      <span className="font-medium">{purchase.currency} {Number(purchase.totalCost).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              ) : <p className="mt-2 text-sm text-base-content/60">Sin compras recientes.</p>}
            </section>
          </div>
        ) : null}
      </div>
      <form method="dialog" className="modal-backdrop"><button onClick={onClose}>cerrar</button></form>
    </dialog>
  )
}
