"use client"

import { useEffect, useMemo, useState } from "react"

type ProvinceOption = {
  id: string
  code: string
  name: string
}

export type BranchFormValue = {
  id?: string
  code: string
  name: string
  province?: string | null
  provinceId?: string | null
  coverageProvinceIds?: string[]
  city?: string | null
  address?: string | null
  phone?: string | null
  email?: string | null
  isActive?: boolean
}

const emptyBranch: BranchFormValue = {
  code: "",
  name: "",
  province: "",
  provinceId: "",
  coverageProvinceIds: [],
  city: "",
  address: "",
  phone: "",
  email: "",
  isActive: true,
}

type BranchFormProps = {
  initial?: BranchFormValue
  formId?: string
  hideActions?: boolean
  onSuccess?: (branch: unknown) => void
  onCancel?: () => void
  onDirtyChange?: (dirty: boolean) => void
  onSubmittingChange?: (submitting: boolean) => void
}

export default function BranchForm({ initial, formId, hideActions = false, onSuccess, onCancel, onDirtyChange, onSubmittingChange }: BranchFormProps) {
  const [form, setForm] = useState<BranchFormValue>(initial ?? emptyBranch)
  const [provinces, setProvinces] = useState<ProvinceOption[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const initialSnapshot = useMemo(() => JSON.stringify(initial ?? emptyBranch), [initial])
  const dirty = JSON.stringify(form) !== initialSnapshot

  useEffect(() => {
    onDirtyChange?.(dirty)
  }, [dirty, onDirtyChange])

  useEffect(() => {
    onSubmittingChange?.(isSaving)
  }, [isSaving, onSubmittingChange])

  useEffect(() => {
    let cancelled = false
    fetch("/api/provinces")
      .then((response) => response.json())
      .then((payload) => {
        if (!cancelled) setProvinces(Array.isArray(payload.provinces) ? payload.provinces : [])
      })
      .catch(() => {
        if (!cancelled) setProvinces([])
      })
    return () => {
      cancelled = true
    }
  }, [])

  const selectedCoverage = useMemo(() => new Set(form.coverageProvinceIds ?? []), [form.coverageProvinceIds])

  function setField(field: keyof BranchFormValue, value: string | boolean | string[]) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  function toggleCoverage(provinceId: string) {
    setForm((prev) => {
      const current = new Set(prev.coverageProvinceIds ?? [])
      if (current.has(provinceId)) current.delete(provinceId)
      else current.add(provinceId)
      return { ...prev, coverageProvinceIds: Array.from(current) }
    })
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setIsSaving(true)
    setError(null)

    try {
      const response = await fetch(initial?.id ? `/api/branches/${initial.id}` : "/api/branches", {
        method: initial?.id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })
      const payload = await response.json().catch(() => null) as { branch?: unknown; error?: string } | null

      if (!response.ok) {
        setError(payload?.error ?? "No se pudo guardar la sucursal")
        return
      }

      onSuccess?.(payload?.branch)
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "No se pudo guardar la sucursal")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <form id={formId} onSubmit={handleSubmit} className="mx-auto max-w-3xl space-y-4">
      <fieldset className="rounded-lg border border-base-300 bg-base-100 p-4">
        <legend className="px-1 text-sm font-semibold uppercase text-base-content/60">Datos de sucursal</legend>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="form-control">
            <span className="label-text">Codigo *</span>
            <input className="input input-bordered" value={form.code} onChange={(event) => setField("code", event.target.value)} required />
          </label>
          <label className="form-control">
            <span className="label-text">Nombre *</span>
            <input className="input input-bordered" value={form.name} onChange={(event) => setField("name", event.target.value)} required />
          </label>
          <label className="form-control">
            <span className="label-text">Provincia</span>
            <select className="select select-bordered" value={form.provinceId ?? ""} onChange={(event) => setField("provinceId", event.target.value)}>
              <option value="">Sin provincia</option>
              {provinces.map((province) => (
                <option key={province.id} value={province.id}>
                  {province.name}
                </option>
              ))}
            </select>
          </label>
          <label className="form-control">
            <span className="label-text">Ciudad</span>
            <input className="input input-bordered" value={form.city ?? ""} onChange={(event) => setField("city", event.target.value)} />
          </label>
          <label className="form-control md:col-span-2">
            <span className="label-text">Direccion</span>
            <input className="input input-bordered" value={form.address ?? ""} onChange={(event) => setField("address", event.target.value)} />
          </label>
          <label className="form-control">
            <span className="label-text">Telefono</span>
            <input className="input input-bordered" value={form.phone ?? ""} onChange={(event) => setField("phone", event.target.value)} />
          </label>
          <label className="form-control">
            <span className="label-text">Email</span>
            <input className="input input-bordered" type="email" value={form.email ?? ""} onChange={(event) => setField("email", event.target.value)} />
          </label>
          <label className="flex items-center gap-2 md:col-span-2">
            <input type="checkbox" className="toggle toggle-primary" checked={form.isActive ?? true} onChange={(event) => setField("isActive", event.target.checked)} />
            <span>Sucursal activa</span>
          </label>
        </div>
      </fieldset>

      <fieldset className="rounded-lg border border-base-300 bg-base-100 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <legend className="px-1 text-sm font-semibold uppercase text-base-content/60">Cobertura comercial</legend>
          <div className="flex gap-2">
            <button type="button" className="btn btn-ghost btn-xs" onClick={() => setField("coverageProvinceIds", provinces.map((province) => province.id))}>
              Todas
            </button>
            <button type="button" className="btn btn-ghost btn-xs" onClick={() => setField("coverageProvinceIds", [])}>
              Ninguna
            </button>
          </div>
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {provinces.map((province) => (
            <label key={province.id} className="flex cursor-pointer items-center gap-2 rounded-lg border border-base-300 p-2 text-sm">
              <input
                type="checkbox"
                className="checkbox checkbox-sm"
                checked={selectedCoverage.has(province.id)}
                onChange={() => toggleCoverage(province.id)}
              />
              <span>{province.name}</span>
            </label>
          ))}
        </div>
        <p className="mt-2 text-xs text-base-content/60">{selectedCoverage.size} provincias seleccionadas</p>
      </fieldset>

      {error ? <div className="alert alert-error text-sm">{error}</div> : null}

      {!hideActions ? (
        <div className="flex justify-end gap-2">
          {onCancel ? <button type="button" className="btn btn-ghost" onClick={onCancel} disabled={isSaving}>Volver</button> : null}
          <button type="submit" className="btn btn-primary" disabled={isSaving}>
            {isSaving ? <><span className="loading loading-spinner loading-xs" /> Guardando...</> : "Guardar sucursal"}
          </button>
        </div>
      ) : null}
    </form>
  )
}
