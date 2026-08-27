"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"

type CommissionPlanFormProps = {
  formId?: string
  hideActions?: boolean
  onSuccess?: () => void
  onCancel?: () => void
  onDirtyChange?: (dirty: boolean) => void
  onSubmittingChange?: (submitting: boolean) => void
}

const emptyForm = { name: "", base: "SALE_PROFIT", ratePct: "", isActive: true }

export default function CommissionPlanForm({ formId, hideActions = false, onSuccess, onCancel, onDirtyChange, onSubmittingChange }: CommissionPlanFormProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const returnCloserId = searchParams.get("closerId")
  const [form, setForm] = useState(emptyForm)
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const initialSnapshot = useMemo(() => JSON.stringify(emptyForm), [])
  const dirty = JSON.stringify(form) !== initialSnapshot

  useEffect(() => {
    onDirtyChange?.(dirty)
  }, [dirty, onDirtyChange])

  useEffect(() => {
    onSubmittingChange?.(isSaving)
  }, [isSaving, onSubmittingChange])

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setIsSaving(true)
    setError(null)

    const response = await fetch("/api/commission-plans", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    })
    const payload = await response.json().catch(() => null)
    setIsSaving(false)

    if (!response.ok) {
      setError(payload?.error ?? "No se pudo crear el plan")
      return
    }

    if (onSuccess) {
      onSuccess()
    } else {
      router.push(returnCloserId ? `/dashboard/commissions/${returnCloserId}/edit` : "/dashboard/commissions")
      router.refresh()
    }
  }

  return (
    <form id={formId} onSubmit={submit} className="space-y-4">
      {error ? <div className="alert alert-error text-sm">{error}</div> : null}

      <section className="space-y-3 rounded-lg border border-base-300 bg-base-100 p-4">
        <div>
          <h2 className="text-lg font-semibold">Datos del plan</h2>
          <p className="text-sm text-base-content/60">El plan define como se calcula la comision al asignarla a una venta.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="form-control">
            <span className="label-text">Nombre *</span>
            <input
              required
              className="input input-bordered"
              value={form.name}
              onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
            />
          </label>
          <label className="form-control">
            <span className="label-text">Base de calculo</span>
            <select
              className="select select-bordered"
              value={form.base}
              onChange={(event) => setForm((prev) => ({ ...prev, base: event.target.value }))}
            >
              <option value="SALE_PROFIT">Ganancia de la venta</option>
              <option value="SALE_TOTAL">Total de la venta</option>
            </select>
          </label>
          <label className="form-control">
            <span className="label-text">Porcentaje *</span>
            <input
              required
              type="number"
              min="0"
              max="100"
              step="0.01"
              className="input input-bordered"
              value={form.ratePct}
              onChange={(event) => setForm((prev) => ({ ...prev, ratePct: event.target.value }))}
            />
          </label>
          <label className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-base-300 px-4 py-3">
            <span>
              <span className="block text-sm font-medium">Plan activo</span>
              <span className="block text-xs text-base-content/60">Disponible para nuevas comisiones.</span>
            </span>
            <input
              type="checkbox"
              className="toggle toggle-primary"
              checked={form.isActive}
              onChange={(event) => setForm((prev) => ({ ...prev, isActive: event.target.checked }))}
            />
          </label>
        </div>
      </section>

      {!hideActions ? (
        <div className="sticky bottom-0 z-10 flex justify-end gap-2 border-t border-base-300 bg-base-100/95 px-1 py-3 backdrop-blur">
          <button type="button" className="btn btn-ghost" onClick={onCancel ?? (() => router.push("/dashboard/commissions"))} disabled={isSaving}>Cancelar</button>
          <button type="submit" className="btn btn-primary" disabled={isSaving}>
            {isSaving ? <span className="loading loading-spinner loading-xs" /> : null}
            Crear plan
          </button>
        </div>
      ) : null}
    </form>
  )
}
