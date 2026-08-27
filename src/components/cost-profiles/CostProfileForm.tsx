"use client"

import { useEffect, useMemo, useState } from "react"

const numericFields = [
  { key: "funda", label: "Funda (USD)" },
  { key: "templado", label: "Templado (USD)" },
  { key: "cable", label: "Cable (USD)" },
  { key: "tarjetaGarantia", label: "Tarjeta Garantia (USD)" },
  { key: "sticker", label: "Sticker (USD)" },
  { key: "envio", label: "Envio (USD)" },
  { key: "cajita", label: "Cajita (USD)" },
  { key: "bolsita", label: "Bolsita (USD)" },
  { key: "comision", label: "Comision (USD)" },
  { key: "total", label: "Total (USD)" },
] as const

type NumericFieldKey = typeof numericFields[number]["key"]

type CostProfileFormState = Record<NumericFieldKey, string> & {
  name: string
}

type CostProfilePayload = Partial<Record<NumericFieldKey, number>> & {
  name: string
}

type CostProfileFormProps = {
  formId?: string
  hideActions?: boolean
  onSuccess?: (profile: unknown) => void
  onCancel?: () => void
  onDirtyChange?: (dirty: boolean) => void
  onSubmittingChange?: (submitting: boolean) => void
}

const emptyForm: CostProfileFormState = {
  name: "",
  funda: "",
  templado: "",
  cable: "",
  tarjetaGarantia: "",
  sticker: "",
  envio: "",
  cajita: "",
  bolsita: "",
  comision: "",
  total: "",
}

function buildPayload(form: CostProfileFormState): CostProfilePayload {
  const payload: CostProfilePayload = { name: form.name.trim() }

  numericFields.forEach(({ key }) => {
    if (form[key] !== "") payload[key] = Number(form[key])
  })

  return payload
}

async function readApiError(response: Response) {
  const contentType = response.headers.get("content-type") || ""
  if (contentType.includes("application/json")) {
    const body = await response.json().catch(() => null) as { error?: string; message?: string } | null
    return body?.error || body?.message || "Error inesperado."
  }
  return (await response.text().catch(() => "")) || "Error inesperado."
}

export default function CostProfileForm({ formId, hideActions = false, onSuccess, onCancel, onDirtyChange, onSubmittingChange }: CostProfileFormProps) {
  const [form, setForm] = useState<CostProfileFormState>(emptyForm)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const initialSnapshot = useMemo(() => JSON.stringify(emptyForm), [])
  const dirty = JSON.stringify(form) !== initialSnapshot

  useEffect(() => {
    onDirtyChange?.(dirty)
  }, [dirty, onDirtyChange])

  useEffect(() => {
    onSubmittingChange?.(saving)
  }, [saving, onSubmittingChange])

  function setField<K extends keyof CostProfileFormState>(key: K, value: CostProfileFormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    setSaving(true)

    try {
      const response = await fetch("/api/cost-profiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload(form)),
      })

      if (!response.ok) throw new Error(await readApiError(response))
      onSuccess?.(await response.json().catch(() => null))
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "No se pudo crear el perfil de costo.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <form id={formId} onSubmit={submit} className="space-y-4">
      {error ? <div className="alert alert-error text-sm">{error}</div> : null}

      <fieldset className="rounded-lg border border-base-300 bg-base-100 p-4">
        <legend className="px-1 text-sm font-semibold uppercase text-base-content/60">Datos del perfil</legend>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="form-control md:col-span-2">
            <span className="label-text">Nombre *</span>
            <input
              type="text"
              value={form.name}
              onChange={(event) => setField("name", event.target.value)}
              required
              disabled={saving}
              className="input input-bordered"
            />
          </label>
          {numericFields.map(({ key, label }) => (
            <label key={key} className="form-control">
              <span className="label-text">{label}</span>
              <input
                type="number"
                step="0.01"
                min="0"
                value={form[key]}
                onChange={(event) => setField(key, event.target.value)}
                disabled={saving}
                className="input input-bordered"
              />
            </label>
          ))}
        </div>
      </fieldset>

      {!hideActions ? (
        <div className="sticky bottom-0 z-10 flex justify-end gap-2 border-t border-base-300 bg-base-100/95 px-1 py-3 backdrop-blur">
          {onCancel ? <button type="button" className="btn btn-ghost" onClick={onCancel} disabled={saving}>Cancelar</button> : null}
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? <span className="loading loading-spinner loading-xs" /> : null}
            Crear perfil
          </button>
        </div>
      ) : null}
    </form>
  )
}
