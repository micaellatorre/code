"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { ArrowsPointingInIcon, ArrowsPointingOutIcon, FunnelIcon } from "@heroicons/react/24/outline"
import { useSession } from "next-auth/react"
import type { Role } from "@/lib/auth/roles"
import { useConfirmDialog } from "@/components/ui/confirm-dialog"
import BuyersFiltersDrawer from "./BuyersFiltersDrawer"
import BuyersTableHeader from "./BuyersTableHeader"
import BuyersTableRow from "./BuyersTableRow"
import { matchesBuyerFilters, normalizeBuyers } from "./buyerUtils"
import type { BuyersFilters, SerializedBuyer } from "./types"

const EMPTY_FILTERS: BuyersFilters = {
  type: "ALL",
  customer: "",
  phone: "",
  instagram: "",
  email: "",
  cuit: "",
  dni: "",
  province: "",
  city: "",
}

export default function BuyersTable({ initial }: { initial: SerializedBuyer[] }) {
  const { data: session } = useSession()
  const confirmDialog = useConfirmDialog()
  const activeRole = (session?.user as { activeRole?: Role } | undefined)?.activeRole
  const canCreate = activeRole === "ADMIN" || activeRole === "VENDEDOR"
  const canEdit = activeRole === "ADMIN" || activeRole === "VENDEDOR"
  const canDelete = activeRole === "ADMIN" || activeRole === "VENDEDOR"

  const [buyers, setBuyers] = useState<SerializedBuyer[]>(() => normalizeBuyers(initial))
  const [searchQuery, setSearchQuery] = useState("")
  const [debouncedQuery, setDebouncedQuery] = useState("")
  const [filters, setFilters] = useState<BuyersFilters>(EMPTY_FILTERS)
  const [loading, setLoading] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [isTableExpanded, setIsTableExpanded] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(searchQuery.trim()), 300)
    return () => window.clearTimeout(timer)
  }, [searchQuery])

  useEffect(() => {
    let ignore = false

    async function run() {
      abortRef.current?.abort()
      const ctrl = new AbortController()
      abortRef.current = ctrl
      setLoading(true)

      try {
        if (!debouncedQuery) {
          if (!ignore) setBuyers(normalizeBuyers(initial))
          return
        }

        const params = new URLSearchParams({ q: debouncedQuery })
        const response = await fetch(`/api/buyers/search?${params.toString()}`, {
          cache: "no-store",
          signal: ctrl.signal,
        })

        if (!response.ok) throw new Error(await response.text())

        const body = (await response.json()) as { results?: unknown[] }
        if (!ignore) setBuyers(normalizeBuyers(body.results ?? []))
      } catch (error: any) {
        if (!ignore && error?.name !== "AbortError") console.error("Buyer search failed", error)
      } finally {
        if (!ignore) setLoading(false)
      }
    }

    void run()

    return () => {
      ignore = true
      abortRef.current?.abort()
    }
  }, [debouncedQuery, initial])

  const displayed = useMemo(
    () => buyers.filter((buyer) => matchesBuyerFilters(buyer, filters, debouncedQuery)),
    [buyers, debouncedQuery, filters],
  )

  function clearFilters() {
    setFilters(EMPTY_FILTERS)
    setSearchQuery("")
    setDrawerOpen(false)
  }

  async function deleteBuyer(id: string) {
    if (!canDelete) return

    const buyer = buyers.find((item) => item.id === id)
    let failed = false

    const confirmed = await confirmDialog.confirmAction({
      variant: "danger",
      title: "Eliminar cliente",
      description: "Esta accion eliminara el cliente del sistema. No podra recuperarse desde esta pantalla.",
      details: buyer
        ? [
            { label: "Cliente", value: [buyer.name, buyer.surname].filter(Boolean).join(" ") },
            { label: "Tipo", value: buyer.type },
            { label: "Telefono", value: buyer.phone ?? "Sin telefono" },
            { label: "Instagram", value: buyer.instagram ?? "Sin Instagram" },
          ]
        : undefined,
      banner: {
        variant: "warning",
        title: "Accion destructiva",
        description: "Verifica que el cliente no sea necesario para consultas operativas antes de continuar.",
      },
      confirmLabel: "Eliminar",
      cancelLabel: "Cerrar",
      loadingLabel: "Eliminando...",
      onConfirm: async () => {
        setDeletingId(id)
        const snapshot = buyers
        setBuyers((prev) => prev.filter((item) => item.id !== id))

        try {
          const response = await fetch(`/api/buyers/${id}`, { method: "DELETE" })
          if (!response.ok) throw new Error(await response.text())
        } catch (error) {
          console.error("Delete buyer failed", error)
          failed = true
          setBuyers(snapshot)
        } finally {
          setDeletingId(null)
        }
      },
    })

    if (confirmed && failed) {
      await confirmDialog.confirm({
        variant: "danger",
        title: "No se pudo eliminar el cliente",
        description: "Se revirtieron los cambios y el cliente vuelve a mostrarse en la tabla.",
        confirmLabel: "Cerrar",
        hideCancel: true,
      })
    }
  }

  const hasActions = canEdit || canDelete
  const emptyColSpan = hasActions ? 7 : 6
  const hasActiveFilters =
    filters.type !== "ALL" ||
    Boolean(
      filters.customer ||
        filters.phone ||
        filters.instagram ||
        filters.email ||
        filters.cuit ||
        filters.dni ||
        filters.province ||
        filters.city,
    )

  return (
    <div className="space-y-4">
      <BuyersTableHeader canCreate={canCreate} />

      <div className="flex flex-wrap items-center gap-2 rounded-box bg-base-200 p-2">
        <input
          type="text"
          className="input input-bordered input-sm min-w-64 flex-1"
          placeholder="Buscar cliente, razon social, DNI, CUIT, telefono, Instagram..."
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
        />
        <span className="badge badge-neutral badge-sm whitespace-nowrap">{displayed.length} clientes</span>
        <button type="button" className="btn btn-outline btn-sm" onClick={() => setDrawerOpen(true)}>
          <FunnelIcon className="size-4" />
          Filtros
          {hasActiveFilters ? <span className="badge badge-primary badge-xs" /> : null}
        </button>
      </div>

      <BuyersFiltersDrawer
        open={drawerOpen}
        filters={filters}
        onClose={() => setDrawerOpen(false)}
        onChange={setFilters}
        onClear={clearFilters}
      />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm text-base-content/60">
          Resultados <span className="font-semibold text-base-content">{displayed.length}</span> de {buyers.length}
        </span>
        <button
          type="button"
          className="btn btn-outline btn-sm"
          onClick={() => setIsTableExpanded((value) => !value)}
        >
          {isTableExpanded ? "Comprimir" : "Expandir"} tabla
          {isTableExpanded ? <ArrowsPointingInIcon className="size-4" /> : <ArrowsPointingOutIcon className="size-4" />}
        </button>
      </div>

      <div className="relative overflow-x-auto rounded-lg border border-base-300 bg-base-100">
        {loading ? (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-base-100/70 text-sm text-base-content/60 backdrop-blur-[1px]">
            Buscando...
          </div>
        ) : null}

        <table className={`table w-full table-pin-rows ${isTableExpanded ? "" : "table-sm"}`}>
          <thead className="text-xs uppercase text-base-content/50">
            <tr>
              <th>Cliente</th>
              <th>Tipo</th>
              <th>Documento</th>
              <th>Contacto</th>
              <th>Ubicacion</th>
              <th>Alta / Actualizacion</th>
              {hasActions ? <th className="text-right">Acciones</th> : null}
            </tr>
          </thead>
          <tbody>
            {displayed.map((buyer) => (
              <BuyersTableRow
                key={buyer.id}
                buyer={buyer}
                canEdit={canEdit}
                canDelete={canDelete}
                isDeleting={deletingId === buyer.id}
                onDelete={() => deleteBuyer(buyer.id)}
              />
            ))}
            {!displayed.length ? (
              <tr>
                <td colSpan={emptyColSpan} className="py-10 text-center text-base-content/60">
                  {debouncedQuery || hasActiveFilters
                    ? "No hay resultados con los filtros aplicados."
                    : "Aun no hay clientes para mostrar."}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  )
}
