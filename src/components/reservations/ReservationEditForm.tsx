"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"

type ReservationEditFormProps = {
  initial: { id: string; pickupAt: string; agreedTotal: string; notes: string }
  formId?: string
  hideActions?: boolean
  onSuccess?: () => void
  onCancel?: () => void
  onDirtyChange?: (dirty: boolean) => void
  onSubmittingChange?: (submitting: boolean) => void
}

export default function ReservationEditForm({ initial, formId, hideActions = false, onSuccess, onCancel, onDirtyChange, onSubmittingChange }: ReservationEditFormProps) {
  const router = useRouter()
  const [form, setForm] = useState(initial)
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const initialSnapshot = useMemo(() => JSON.stringify(initial), [initial])
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
    try {
      const response = await fetch(`/api/reservations/${initial.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })
      if (!response.ok) {
        const payload = await response.json().catch(() => null)
        setError(payload?.error ?? "No se pudo actualizar")
        return
      }
      if (onSuccess) {
        onSuccess()
      } else {
        router.push(`/dashboard/reservations/${initial.id}`)
        router.refresh()
      }
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "No se pudo actualizar")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <form id={formId} onSubmit={submit} className="mx-auto max-w-2xl space-y-4">
      <label className="form-control">
        <span className="label-text">Cuando pasa</span>
        <input type="datetime-local" className="input input-bordered" value={form.pickupAt} onChange={(event) => setForm((prev) => ({ ...prev, pickupAt: event.target.value }))} />
      </label>
      <label className="form-control">
        <span className="label-text">Total acordado</span>
        <input type="number" step="0.01" className="input input-bordered" value={form.agreedTotal} onChange={(event) => setForm((prev) => ({ ...prev, agreedTotal: event.target.value }))} />
      </label>
      <label className="form-control">
        <span className="label-text">Notas</span>
        <textarea className="textarea textarea-bordered" value={form.notes} onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))} />
      </label>
      {error ? <div className="alert alert-error text-sm">{error}</div> : null}
      {!hideActions ? (
        <div className="flex justify-end gap-2">
          <button type="button" className="btn btn-ghost" onClick={onCancel ?? (() => router.back())} disabled={isSaving}>Volver</button>
          <button type="submit" className="btn btn-primary" disabled={isSaving}>{isSaving ? "Guardando..." : "Guardar"}</button>
        </div>
      ) : null}
    </form>
  )
}
