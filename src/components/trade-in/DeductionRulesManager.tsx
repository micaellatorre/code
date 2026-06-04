"use client"

import { useState } from "react"
import { IPHONE_TRADE_IN_CATALOG } from "@/lib/trade-in/iphoneCatalog"
import type { TradeInDeductionCategory, TradeInDeductionRuleDto, TradeInDeductionScope } from "./types"
import { TRADE_IN_CATEGORIES, TRADE_IN_CATEGORY_LABELS } from "./utils"

type Draft = {
  id?: string
  category: TradeInDeductionCategory
  label: string
  amount: string
  scope: TradeInDeductionScope
  modelName: string
  capacityGB: string
  sortOrder: number
  isActive: boolean
}

const emptyDraft: Draft = { category: "PANTALLA_MODULO", label: "", amount: "0", scope: "GLOBAL", modelName: "", capacityGB: "", sortOrder: 0, isActive: true }

export default function DeductionRulesManager({ rules, onChange }: { rules: TradeInDeductionRuleDto[]; onChange: () => Promise<void> }) {
  const [draft, setDraft] = useState<Draft>(emptyDraft)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const models = IPHONE_TRADE_IN_CATALOG.flatMap((series) => series.models)
  const selectedModel = models.find((model) => model.modelName === draft.modelName)

  const save = async () => {
    setSaving(true)
    setError(null)
    const url = draft.id ? `/api/trade-in/deduction-rules/${draft.id}` : "/api/trade-in/deduction-rules"
    const res = await fetch(url, {
      method: draft.id ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...draft,
        amount: Number(draft.amount || 0),
        modelName: draft.scope === "GLOBAL" ? null : draft.modelName,
        capacityGB: draft.scope === "MODEL_CAPACITY" ? Number(draft.capacityGB) : null,
      }),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => null)
      setError(data?.error ?? "No se pudo guardar la regla")
      setSaving(false)
      return
    }
    setDraft(emptyDraft)
    await onChange()
    setSaving(false)
  }

  const disable = async (id: string) => {
    const res = await fetch(`/api/trade-in/deduction-rules/${id}`, { method: "DELETE" })
    if (!res.ok) {
      const data = await res.json().catch(() => null)
      setError(data?.error ?? "No se pudo desactivar")
      return
    }
    await onChange()
  }

  const scopeLabel = (rule: TradeInDeductionRuleDto) => {
    if (rule.scope === "GLOBAL") return "Global"
    if (rule.scope === "MODEL") return rule.modelName ?? "Modelo"
    return `${rule.modelName ?? "Modelo"} ${rule.capacityGB ?? "-"} GB`
  }

  return (
    <section className="rounded-lg border border-base-300 bg-base-100 p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Reglas de descuento</h2>
        <button type="button" className="btn btn-sm btn-ghost" onClick={() => setDraft(emptyDraft)}>Nueva</button>
      </div>
      {error ? <div className="alert alert-error mb-3 py-2 text-sm">{error}</div> : null}
      <div className="rounded-lg border border-dashed border-base-300 p-3 focus-within:border-primary">
        <div className="grid gap-3 md:grid-cols-4">
          <label className="form-control">
            <span className="label-text">Categoria</span>
            <select className="select select-bordered select-sm" value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value as TradeInDeductionCategory })}>
              {TRADE_IN_CATEGORIES.map((category) => <option key={category} value={category}>{TRADE_IN_CATEGORY_LABELS[category]}</option>)}
            </select>
          </label>
          <label className="form-control md:col-span-2">
            <span className="label-text">Detalle</span>
            <input className="input input-bordered input-sm" value={draft.label} onChange={(e) => setDraft({ ...draft, label: e.target.value })} />
          </label>
          <label className="form-control">
            <span className="label-text">Alcance</span>
            <select className="select select-bordered select-sm" value={draft.scope} onChange={(e) => setDraft({ ...draft, scope: e.target.value as TradeInDeductionScope, modelName: "", capacityGB: "" })}>
              <option value="GLOBAL">Global</option>
              <option value="MODEL">Modelo</option>
              <option value="MODEL_CAPACITY">Modelo + Capacidad</option>
            </select>
          </label>
          {draft.scope !== "GLOBAL" ? (
            <label className="form-control">
              <span className="label-text">Modelo</span>
              <select className="select select-bordered select-sm" value={draft.modelName} onChange={(e) => setDraft({ ...draft, modelName: e.target.value, capacityGB: "" })}>
                <option value="">Seleccionar</option>
                {models.map((model) => <option key={model.modelName} value={model.modelName}>{model.modelName}</option>)}
              </select>
            </label>
          ) : null}
          {draft.scope === "MODEL_CAPACITY" ? (
            <label className="form-control">
              <span className="label-text">Capacidad</span>
              <select className="select select-bordered select-sm" value={draft.capacityGB} onChange={(e) => setDraft({ ...draft, capacityGB: e.target.value })} disabled={!selectedModel}>
                <option value="">Seleccionar</option>
                {selectedModel?.capacities.map((capacity) => <option key={capacity} value={capacity}>{capacity} GB</option>)}
              </select>
            </label>
          ) : null}
          <label className="form-control">
            <span className="label-text">Descuento USD</span>
            <input className="input input-bordered input-sm" type="number" min={0} value={draft.amount} onChange={(e) => setDraft({ ...draft, amount: e.target.value })} />
          </label>
          <label className="form-control">
            <span className="label-text">Orden</span>
            <input className="input input-bordered input-sm" type="number" value={draft.sortOrder} onChange={(e) => setDraft({ ...draft, sortOrder: Number(e.target.value) })} />
          </label>
          <label className="flex items-end gap-2 pb-2 text-sm">
            <input className="toggle toggle-sm" type="checkbox" checked={draft.isActive} onChange={(e) => setDraft({ ...draft, isActive: e.target.checked })} />
            Activo
          </label>
          <div className="flex items-end">
            <button type="button" className="btn btn-primary btn-sm w-full" onClick={save} disabled={saving}>{saving ? "Guardando" : draft.id ? "Actualizar regla" : "Crear regla"}</button>
          </div>
        </div>
      </div>
      <div className="mt-4 overflow-x-auto">
        <table className="table table-sm">
          <thead><tr><th>Categoria</th><th>Label</th><th>Alcance</th><th>Descuento USD</th><th>Activo</th><th>Orden</th><th>Acciones</th></tr></thead>
          <tbody>
            {rules.map((rule) => (
              <tr key={rule.id} className={!rule.isActive ? "opacity-50" : undefined}>
                <td>{TRADE_IN_CATEGORY_LABELS[rule.category]}</td><td>{rule.label}</td><td>{scopeLabel(rule)}</td><td>USD {rule.amount}</td><td>{rule.isActive ? "Si" : "No"}</td><td>{rule.sortOrder}</td>
                <td className="flex gap-2">
                  <button type="button" className="btn btn-xs" onClick={() => setDraft({ ...rule, amount: rule.amount, modelName: rule.modelName ?? "", capacityGB: rule.capacityGB ? String(rule.capacityGB) : "" })}>Editar</button>
                  <button type="button" className="btn btn-xs btn-outline" onClick={() => disable(rule.id)} disabled={!rule.isActive}>Desactivar</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
