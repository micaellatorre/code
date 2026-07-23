"use client"

import { useEffect, useMemo, useState } from "react"
import { MagnifyingGlassIcon, PlusIcon } from "@heroicons/react/24/outline"
import type { SerializedSale } from "./types"
import { getSaleBuyerName } from "./salesUtils"

type BuyerKind = "MINORISTA" | "MAYORISTA"

type BuyerSearchResult = {
  id: string
  type: BuyerKind | string
  name: string
  surname: string | null
  businessName?: string | null
  phone?: string | null
  instagram?: string | null
  email?: string | null
  dni?: string | null
  cuit?: string | null
}

type NewBuyerForm = {
  name: string
  surname: string
  businessName: string
  dni: string
  cuit: string
  phone: string
  instagram: string
  email: string
  notes: string
}

type Props = {
  sale: SerializedSale
  open: boolean
  onClose: () => void
  onSaved: (sale: SerializedSale) => void
}

const emptyNewBuyer: NewBuyerForm = {
  name: "",
  surname: "",
  businessName: "",
  dni: "",
  cuit: "",
  phone: "",
  instagram: "",
  email: "",
  notes: "",
}

function currentBuyerKind(sale: SerializedSale): BuyerKind {
  if (sale.buyer?.type === "MAYORISTA" || sale.saleType === "MAYORISTA") return "MAYORISTA"
  return "MINORISTA"
}

function buyerDisplayName(buyer: BuyerSearchResult) {
  if (buyer.type === "MAYORISTA" && buyer.businessName) return buyer.businessName
  return [buyer.name, buyer.surname].filter(Boolean).join(" ")
}

function validateNewBuyer(kind: BuyerKind, form: NewBuyerForm) {
  if (!form.name.trim()) return "El nombre es obligatorio."
  if (!form.surname.trim()) return "El apellido es obligatorio."
  if (kind === "MINORISTA" && !form.dni.trim()) return "El DNI es obligatorio para clientes minoristas."
  if (kind === "MAYORISTA" && !form.businessName.trim()) return "La razon social es obligatoria para clientes mayoristas."
  if (kind === "MAYORISTA" && !form.cuit.trim()) return "El CUIT es obligatorio para clientes mayoristas."
  return null
}

async function readError(response: Response) {
  const body = await response.json().catch(() => null)
  return body?.error ?? body?.message ?? "No se pudo guardar el cliente de la venta."
}

export default function SaleCustomerUpdateModal({ sale, open, onClose, onSaved }: Props) {
  const [kind, setKind] = useState<BuyerKind>(currentBuyerKind(sale))
  const [query, setQuery] = useState("")
  const [debouncedQuery, setDebouncedQuery] = useState("")
  const [results, setResults] = useState<BuyerSearchResult[]>([])
  const [selectedBuyer, setSelectedBuyer] = useState<BuyerSearchResult | null>(null)
  const [creatingNew, setCreatingNew] = useState(false)
  const [newBuyer, setNewBuyer] = useState<NewBuyerForm>(emptyNewBuyer)
  const [searching, setSearching] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canSave = Boolean(selectedBuyer || creatingNew)
  const currentLabel = useMemo(() => getSaleBuyerName(sale), [sale])

  useEffect(() => {
    if (!open) return
    setKind(currentBuyerKind(sale))
    setQuery("")
    setDebouncedQuery("")
    setResults([])
    setSelectedBuyer(null)
    setCreatingNew(false)
    setNewBuyer(emptyNewBuyer)
    setError(null)
  }, [open, sale])

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(query.trim()), 250)
    return () => window.clearTimeout(timer)
  }, [query])

  useEffect(() => {
    if (!open || debouncedQuery.length < 3) {
      setResults([])
      setSearching(false)
      return
    }

    let ignore = false
    const controller = new AbortController()

    async function run() {
      setSearching(true)
      try {
        const params = new URLSearchParams({ q: debouncedQuery, type: kind })
        const response = await fetch(`/api/buyers/search?${params.toString()}`, { cache: "no-store", signal: controller.signal })
        const payload = await response.json().catch(() => null)
        if (!response.ok) throw new Error(payload?.error ?? "No se pudo buscar clientes.")
        if (!ignore) setResults(Array.isArray(payload.results) ? payload.results : [])
      } catch (err: any) {
        if (!ignore && err?.name !== "AbortError") setResults([])
      } finally {
        if (!ignore) setSearching(false)
      }
    }

    void run()
    return () => {
      ignore = true
      controller.abort()
    }
  }, [debouncedQuery, kind, open])

  function changeKind(nextKind: BuyerKind) {
    setKind(nextKind)
    setQuery("")
    setResults([])
    setSelectedBuyer(null)
    setNewBuyer(emptyNewBuyer)
    setError(null)
  }

  function updateNewBuyer<K extends keyof NewBuyerForm>(key: K, value: NewBuyerForm[K]) {
    setNewBuyer((current) => ({ ...current, [key]: value }))
  }

  async function createBuyer() {
    const validation = validateNewBuyer(kind, newBuyer)
    if (validation) throw new Error(validation)
    const response = await fetch("/api/buyers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: kind,
        name: newBuyer.name,
        surname: newBuyer.surname,
        businessName: kind === "MAYORISTA" ? newBuyer.businessName : null,
        dni: newBuyer.dni || null,
        cuit: kind === "MAYORISTA" ? newBuyer.cuit : null,
        phone: newBuyer.phone || null,
        instagram: newBuyer.instagram || null,
        email: newBuyer.email || null,
        notes: newBuyer.notes || null,
      }),
    })
    const payload = await response.json().catch(() => null)
    if (!response.ok || !payload?.buyer?.id) throw new Error(payload?.error ?? "No se pudo crear el cliente.")
    return payload.buyer as BuyerSearchResult
  }

  async function save() {
    setSaving(true)
    setError(null)
    try {
      const buyer = creatingNew ? await createBuyer() : selectedBuyer
      if (!buyer?.id) throw new Error("Selecciona o crea un cliente.")

      const response = await fetch(`/api/sales/${sale.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ buyerId: buyer.id, saleType: kind }),
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok || !payload?.sale) throw new Error(payload?.error ?? "No se pudo actualizar la venta.")
      onSaved(payload.sale as SerializedSale)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo actualizar el cliente de la venta.")
    } finally {
      setSaving(false)
    }
  }

  if (!open) return null

  return (
    <div className="modal modal-open" role="dialog" aria-modal="true" aria-labelledby="sale-customer-modal-title">
      <div className="modal-box max-h-[88vh] max-w-3xl overflow-y-auto rounded-lg">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="sale-customer-modal-title" className="text-lg font-semibold">Asignar cliente a venta</h2>
            <p className="mt-1 text-sm text-base-content/60">Cliente actual: {currentLabel}</p>
          </div>
          <button type="button" className="btn btn-square btn-ghost btn-sm" aria-label="Cerrar" onClick={onClose} disabled={saving}>x</button>
        </div>

        {error ? <div className="alert alert-error mt-4 text-sm">{error}</div> : null}

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <div className="join">
            <button type="button" className={`btn btn-sm join-item ${kind === "MINORISTA" ? "btn-primary" : "btn-outline"}`} onClick={() => changeKind("MINORISTA")} disabled={saving}>Minorista</button>
            <button type="button" className={`btn btn-sm join-item ${kind === "MAYORISTA" ? "btn-primary" : "btn-outline"}`} onClick={() => changeKind("MAYORISTA")} disabled={saving}>Mayorista</button>
          </div>
          <div className="text-sm text-base-content/60">Venta {sale.id}</div>
        </div>

        <section className="mt-4 rounded border border-base-300 bg-base-100 p-4">
          <label className="form-control">
            <span className="label-text">Buscar cliente existente</span>
            <div className="relative mt-1">
              <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-base-content/40" />
              <input
                className="input input-bordered input-sm w-full pl-9"
                placeholder="Escribi al menos 3 caracteres..."
                value={query}
                disabled={saving}
                onChange={(event) => {
                  setQuery(event.target.value)
                  setSelectedBuyer(null)
                  setCreatingNew(false)
                }}
              />
            </div>
          </label>

          {selectedBuyer ? (
            <div className="mt-3 rounded border border-primary bg-primary/5 p-3 text-sm">
              <div className="font-medium">{buyerDisplayName(selectedBuyer)}</div>
              <div className="text-base-content/60">{[selectedBuyer.phone, selectedBuyer.instagram, selectedBuyer.email].filter(Boolean).join(" - ") || "Sin contacto"}</div>
            </div>
          ) : null}

          {query.trim().length > 0 && query.trim().length < 3 ? <p className="mt-2 text-xs text-base-content/60">La busqueda empieza desde el tercer caracter.</p> : null}
          {searching ? <div className="mt-3 h-16 animate-pulse rounded bg-base-200" /> : null}
          {!searching && results.length ? (
            <div className="mt-3 max-h-56 overflow-y-auto rounded border border-base-300">
              {results.map((buyer) => (
                <button
                  key={buyer.id}
                  type="button"
                  className="flex w-full items-start justify-between gap-3 border-b border-base-300 p-3 text-left text-sm last:border-b-0 hover:bg-base-200"
                  onClick={() => {
                    setSelectedBuyer(buyer)
                    setCreatingNew(false)
                    setQuery(buyerDisplayName(buyer))
                  }}
                  disabled={saving}
                >
                  <span>
                    <span className="block font-medium">{buyerDisplayName(buyer)}</span>
                    <span className="block text-xs text-base-content/60">{[buyer.dni || buyer.cuit, buyer.phone, buyer.instagram, buyer.email].filter(Boolean).join(" - ") || "Sin datos extra"}</span>
                  </span>
                  <span className="badge badge-outline badge-sm">{buyer.type}</span>
                </button>
              ))}
            </div>
          ) : null}
        </section>

        <section className="mt-4 rounded border border-base-300 bg-base-100 p-4">
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={() => {
              setCreatingNew((current) => !current)
              setSelectedBuyer(null)
              setError(null)
            }}
            disabled={saving}
          >
            <PlusIcon className="size-4" />
            Agregar nuevo cliente
          </button>

          {creatingNew ? (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <TextInput label="Nombre *" value={newBuyer.name} disabled={saving} onChange={(value) => updateNewBuyer("name", value)} />
              <TextInput label="Apellido *" value={newBuyer.surname} disabled={saving} onChange={(value) => updateNewBuyer("surname", value)} />
              {kind === "MAYORISTA" ? (
                <>
                  <TextInput label="Razon social *" value={newBuyer.businessName} disabled={saving} onChange={(value) => updateNewBuyer("businessName", value)} />
                  <TextInput label="CUIT *" value={newBuyer.cuit} disabled={saving} onChange={(value) => updateNewBuyer("cuit", value)} />
                  <TextInput label="DNI" value={newBuyer.dni} disabled={saving} onChange={(value) => updateNewBuyer("dni", value)} />
                </>
              ) : (
                <TextInput label="DNI *" value={newBuyer.dni} disabled={saving} onChange={(value) => updateNewBuyer("dni", value)} />
              )}
              <TextInput label="Telefono" value={newBuyer.phone} disabled={saving} onChange={(value) => updateNewBuyer("phone", value)} />
              <TextInput label="Instagram" value={newBuyer.instagram} disabled={saving} onChange={(value) => updateNewBuyer("instagram", value)} />
              <TextInput label="Email" value={newBuyer.email} disabled={saving} onChange={(value) => updateNewBuyer("email", value)} />
              <label className="form-control sm:col-span-2">
                <span className="label-text">Notas</span>
                <textarea className="textarea textarea-bordered min-h-20" value={newBuyer.notes} disabled={saving} onChange={(event) => updateNewBuyer("notes", event.target.value)} />
              </label>
            </div>
          ) : null}
        </section>

        <div className="modal-action">
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={saving}>Cancelar</button>
          <button type="button" className="btn btn-primary" onClick={save} disabled={saving || !canSave}>
            {saving ? <span className="loading loading-spinner loading-xs" /> : null}
            Aplicar cliente
          </button>
        </div>
      </div>
      <button type="button" className="modal-backdrop" aria-label="Cerrar" onClick={onClose} disabled={saving}>cerrar</button>
    </div>
  )
}

function TextInput({
  label,
  value,
  disabled,
  onChange,
}: {
  label: string
  value: string
  disabled: boolean
  onChange: (value: string) => void
}) {
  return (
    <label className="form-control">
      <span className="label-text">{label}</span>
      <input className="input input-bordered input-sm" value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)} />
    </label>
  )
}
