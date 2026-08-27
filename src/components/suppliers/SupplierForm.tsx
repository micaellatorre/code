"use client"

import { useEffect, useMemo, useState } from "react"
import BranchAutocomplete, { type BranchOption } from "@/components/branches/BranchAutocomplete"
import type { ProvinceOption, SupplierListItem } from "./types"

type SupplierFormProps = {
  mode: "create" | "edit"
  supplier?: SupplierListItem
  formId?: string
  hideActions?: boolean
  onSuccess?: (supplier: SupplierListItem) => void
  onCancel?: () => void
  onDirtyChange?: (dirty: boolean) => void
  onSubmittingChange?: (submitting: boolean) => void
}

type FormState = {
  name: string
  contactName: string
  phone: string
  email: string
  provinceId: string
  city: string
  postalCode: string
  addressStreet: string
  addressNumber: string
  branchId: string
  branchCoverageIds: string[]
}

function buildInitialState(supplier?: SupplierListItem): FormState {
  return {
    name: supplier?.name ?? "",
    contactName: supplier?.contactName ?? "",
    phone: supplier?.phone ?? "",
    email: supplier?.email ?? "",
    provinceId: supplier?.provinceId ?? "",
    city: supplier?.city ?? "",
    postalCode: supplier?.postalCode ?? "",
    addressStreet: supplier?.addressStreet ?? "",
    addressNumber: supplier?.addressNumber ?? "",
    branchId: supplier?.branchId ?? "",
    branchCoverageIds: supplier?.branchCoverages.map((branch) => branch.id) ?? [],
  }
}

export default function SupplierForm({
  mode,
  supplier,
  formId,
  hideActions = false,
  onSuccess,
  onCancel,
  onDirtyChange,
  onSubmittingChange,
}: SupplierFormProps) {
  const [branches, setBranches] = useState<BranchOption[]>([])
  const [provinces, setProvinces] = useState<ProvinceOption[]>([])
  const [form, setForm] = useState<FormState>(() => buildInitialState(supplier))
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const initialSnapshot = useMemo(() => JSON.stringify(buildInitialState(supplier)), [supplier])
  const dirty = JSON.stringify(form) !== initialSnapshot

  useEffect(() => {
    onDirtyChange?.(dirty)
  }, [dirty, onDirtyChange])

  useEffect(() => {
    onSubmittingChange?.(saving)
  }, [saving, onSubmittingChange])

  useEffect(() => {
    async function loadOptions() {
      const [branchRes, provinceRes] = await Promise.all([fetch("/api/branches"), fetch("/api/provinces")])
      if (branchRes.ok) {
        const payload = await branchRes.json()
        const nextBranches = Array.isArray(payload.branches)
          ? payload.branches.filter((branch: BranchOption & { isActive?: boolean }) => branch.isActive !== false)
          : []
        setBranches(nextBranches)
      }
      if (provinceRes.ok) {
        const payload = await provinceRes.json()
        setProvinces(Array.isArray(payload.provinces) ? payload.provinces : [])
      }
    }
    loadOptions().catch(() => {
      setBranches([])
      setProvinces([])
    })
  }, [])

  const coverageBranches = useMemo(
    () => branches.filter((branch) => branch.id !== form.branchId),
    [branches, form.branchId],
  )

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function setPrimaryBranch(branchId: string) {
    setForm((prev) => ({
      ...prev,
      branchId,
      branchCoverageIds: prev.branchCoverageIds.filter((id) => id !== branchId),
    }))
  }

  function toggleCoverage(branchId: string) {
    setForm((prev) => {
      if (branchId === prev.branchId) return prev
      return {
        ...prev,
        branchCoverageIds: prev.branchCoverageIds.includes(branchId)
          ? prev.branchCoverageIds.filter((id) => id !== branchId)
          : [...prev.branchCoverageIds, branchId],
      }
    })
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    setSaving(true)

    try {
      const response = await fetch(mode === "create" ? "/api/suppliers" : `/api/suppliers/${supplier?.id}`, {
        method: mode === "create" ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })
      const payload = await response.json().catch(() => null) as SupplierListItem | { error?: string } | null
      if (!response.ok) {
        setError(payload && "error" in payload ? payload.error ?? "No se pudo guardar el proveedor" : "No se pudo guardar el proveedor")
        return
      }
      onSuccess?.(payload as SupplierListItem)
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "No se pudo guardar el proveedor")
    } finally {
      setSaving(false)
    }
  }

  return (
    <form id={formId} onSubmit={submit} className="space-y-4">
      {error ? <div className="alert alert-error text-sm">{error}</div> : null}

      <section className="space-y-3 rounded-lg border border-base-300 bg-base-100 p-4">
        <div>
          <h2 className="text-lg font-semibold">Datos del proveedor</h2>
          <p className="text-sm text-base-content/60">Informacion comercial y contacto operativo.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="form-control">
            <span className="label-text">Nombre / Razon identificativa *</span>
            <input className="input input-bordered" value={form.name} onChange={(event) => setField("name", event.target.value)} required />
          </label>
          <label className="form-control">
            <span className="label-text">Nombre de contacto</span>
            <input className="input input-bordered" value={form.contactName} onChange={(event) => setField("contactName", event.target.value)} />
          </label>
          <label className="form-control">
            <span className="label-text">Telefono</span>
            <input className="input input-bordered" value={form.phone} onChange={(event) => setField("phone", event.target.value)} />
          </label>
          <label className="form-control">
            <span className="label-text">Email</span>
            <input className="input input-bordered" type="email" value={form.email} onChange={(event) => setField("email", event.target.value)} />
          </label>
        </div>
      </section>

      <section className="space-y-3 rounded-lg border border-base-300 bg-base-100 p-4">
        <div>
          <h2 className="text-lg font-semibold">Ubicacion</h2>
          <p className="text-sm text-base-content/60">Datos normalizados de provincia y direccion.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="form-control">
            <span className="label-text">Provincia</span>
            <select className="select select-bordered" value={form.provinceId} onChange={(event) => setField("provinceId", event.target.value)}>
              <option value="">Sin provincia</option>
              {provinces.map((province) => <option key={province.id} value={province.id}>{province.name}</option>)}
            </select>
          </label>
          <label className="form-control">
            <span className="label-text">Ciudad</span>
            <input className="input input-bordered" value={form.city} onChange={(event) => setField("city", event.target.value)} />
          </label>
          <label className="form-control">
            <span className="label-text">Codigo postal</span>
            <input className="input input-bordered" value={form.postalCode} onChange={(event) => setField("postalCode", event.target.value.toUpperCase())} />
          </label>
          <div className="grid gap-3 sm:grid-cols-[1fr_120px]">
            <label className="form-control">
              <span className="label-text">Calle</span>
              <input className="input input-bordered" value={form.addressStreet} onChange={(event) => setField("addressStreet", event.target.value)} />
            </label>
            <label className="form-control">
              <span className="label-text">Numero</span>
              <input className="input input-bordered" value={form.addressNumber} onChange={(event) => setField("addressNumber", event.target.value)} />
            </label>
          </div>
        </div>
      </section>

      <section className="space-y-3 rounded-lg border border-base-300 bg-base-100 p-4">
        <div>
          <h2 className="text-lg font-semibold">Sucursales</h2>
          <p className="text-sm text-base-content/60">Sucursal principal y cobertura adicional de abastecimiento.</p>
        </div>
        <BranchAutocomplete
          value={form.branchId || null}
          branches={branches}
          onChange={setPrimaryBranch}
          placeholder="Sucursal principal"
        />
        <p className="text-sm text-base-content/60">
          El proveedor podra utilizarse en compras de su sucursal principal y de las sucursales cubiertas.
        </p>
        <div>
          <h3 className="mb-2 text-sm font-semibold">Cobertura adicional</h3>
          <div className="grid gap-2 sm:grid-cols-2">
            {coverageBranches.map((branch) => (
              <label key={branch.id} className="flex items-center gap-2 rounded border border-base-300 px-3 py-2 text-sm">
                <input
                  type="checkbox"
                  className="checkbox checkbox-sm"
                  checked={form.branchCoverageIds.includes(branch.id)}
                  onChange={() => toggleCoverage(branch.id)}
                />
                <span>{branch.name}</span>
                <span className="ml-auto text-xs text-base-content/50">{branch.code}</span>
              </label>
            ))}
            {!coverageBranches.length ? <p className="text-sm text-base-content/60">No hay sucursales adicionales disponibles.</p> : null}
          </div>
        </div>
      </section>

      {!hideActions ? (
        <div className="sticky bottom-0 z-10 flex justify-end gap-2 border-t border-base-300 bg-base-100/95 px-1 py-3 backdrop-blur">
          {onCancel ? <button type="button" className="btn btn-ghost" onClick={onCancel} disabled={saving}>Cancelar</button> : null}
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? <span className="loading loading-spinner loading-xs" /> : null}
            {mode === "create" ? "Crear proveedor" : "Guardar cambios"}
          </button>
        </div>
      ) : null}
    </form>
  )
}
