"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

export default function ReservationEditForm({ initial }: { initial: { id: string; pickupAt: string; agreedTotal: string; notes: string } }) {
  const router = useRouter()
  const [form, setForm] = useState(initial)
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setIsSaving(true)
    setError(null)
    const response = await fetch(`/api/reservations/${initial.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    })
    setIsSaving(false)
    if (!response.ok) {
      const payload = await response.json().catch(() => null)
      setError(payload?.error ?? "No se pudo actualizar")
      return
    }
    router.push(`/dashboard/reservations/${initial.id}`)
    router.refresh()
  }

  return (
    <form onSubmit={submit} className="mx-auto max-w-2xl space-y-4">
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
      <div className="flex justify-end gap-2">
        <button type="button" className="btn btn-ghost" onClick={() => router.back()} disabled={isSaving}>Volver</button>
        <button type="submit" className="btn btn-primary" disabled={isSaving}>{isSaving ? "Guardando..." : "Guardar"}</button>
      </div>
    </form>
  )
}
