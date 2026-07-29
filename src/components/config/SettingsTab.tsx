"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { ArrowUpTrayIcon, TrashIcon } from "@heroicons/react/24/outline"
import type { SettingsDto, SettingsPayload } from "@/components/config/types"

type SettingsForm = SettingsDto & { tenantName: string }

function toForm(payload: SettingsPayload): SettingsForm {
  return {
    tenantName: payload.tenant.name,
    ...payload.settings,
  }
}

function stable(value: unknown) {
  return JSON.stringify(value)
}

export default function SettingsTab() {
  const [payload, setPayload] = useState<SettingsPayload | null>(null)
  const [form, setForm] = useState<SettingsForm | null>(null)
  const [baseline, setBaseline] = useState<string>("")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [logoSaving, setLogoSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    setError(null)
    const response = await fetch("/api/config/settings", { cache: "no-store" })
    const body = await response.json().catch(() => null)
    if (!response.ok) {
      setError(body?.error ?? "No se pudo cargar configuracion")
      setLoading(false)
      return
    }
    const nextForm = toForm(body)
    setPayload(body)
    setForm(nextForm)
    setBaseline(stable(nextForm))
    setLoading(false)
  }

  useEffect(() => {
    void load()
  }, [])

  const dirty = useMemo(() => (form ? stable(form) !== baseline : false), [baseline, form])

  function setField<K extends keyof SettingsForm>(key: K, value: SettingsForm[K]) {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev))
  }

  function showToast(message: string) {
    setToast(message)
    window.setTimeout(() => setToast(null), 3000)
  }

  async function save() {
    if (!form || saving) return
    setSaving(true)
    setError(null)
    const response = await fetch("/api/config/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tenantName: form.tenantName,
        servicePickupAlertDays: form.servicePickupAlertDays,
        stockRotationHighMaxDays: form.stockRotationHighMaxDays,
        stockRotationMediumMaxDays: form.stockRotationMediumMaxDays,
        accessoryLowStockThreshold: form.accessoryLowStockThreshold,
        wholesalePricesEnabled: form.wholesalePricesEnabled,
        closerCommissionsEnabled: form.closerCommissionsEnabled,
        financialFeeEnabled: form.financialFeeEnabled,
        financialFeeRatePct: Number(form.financialFeeRatePct),
        usedDeviceWarrantyDays: form.usedDeviceWarrantyDays,
        warrantyPolicyText: form.warrantyPolicyText,
      }),
    })
    const body = await response.json().catch(() => null)
    setSaving(false)

    if (!response.ok) {
      setError(body?.error ?? "No se pudo guardar configuracion")
      return
    }

    const nextPayload = { ...(payload as SettingsPayload), tenant: body.tenant, settings: body.settings }
    const nextForm = toForm(nextPayload)
    setPayload(nextPayload)
    setForm(nextForm)
    setBaseline(stable(nextForm))
    showToast("Configuracion guardada")
  }

  async function uploadLogo(file: File | null) {
    if (!file) return
    setLogoSaving(true)
    setError(null)
    const formData = new FormData()
    formData.append("file", file)
    const response = await fetch("/api/config/logo", { method: "POST", body: formData })
    const body = await response.json().catch(() => null)
    setLogoSaving(false)
    if (!response.ok) {
      setError(body?.error ?? "No se pudo subir el logo")
      return
    }
    await load()
    showToast("Logo actualizado")
  }

  async function deleteLogo() {
    setLogoSaving(true)
    const response = await fetch("/api/config/logo", { method: "DELETE" })
    const body = await response.json().catch(() => null)
    setLogoSaving(false)
    if (!response.ok) {
      setError(body?.error ?? "No se pudo eliminar el logo")
      return
    }
    await load()
    showToast("Logo eliminado")
  }

  if (loading) {
    return <div className="rounded-lg border border-base-300 p-6"><span className="loading loading-spinner" /></div>
  }

  if (!form || !payload) {
    return <div className="alert alert-error">{error ?? "Configuracion no disponible"}</div>
  }

  const commissionDisabled = payload.activeCommissionPlans < 1

  return (
    <div className="space-y-4 pb-24">
      {toast ? (
        <div className="toast toast-top toast-end z-[120]">
          <div className="alert alert-success text-sm shadow-lg"><span>{toast}</span></div>
        </div>
      ) : null}
      {error ? <div className="alert alert-error py-3 text-sm">{error}</div> : null}

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-base-300 bg-base-100 p-4">
          <h2 className="text-lg font-semibold">Identidad del negocio</h2>
          <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="flex size-28 items-center justify-center overflow-hidden rounded-lg border border-base-300 bg-base-200">
              {payload.logo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={payload.logo.url} alt="Logo del negocio" className="max-h-full max-w-full object-contain" />
              ) : (
                <span className="text-xs text-base-content/50">Sin logo</span>
              )}
            </div>
            <div className="flex flex-1 flex-col gap-3">
              <label className="form-control">
                <span className="label-text">Nombre del negocio</span>
                <input className="input input-bordered" value={form.tenantName} onChange={(event) => setField("tenantName", event.target.value)} />
              </label>
              <div className="flex flex-wrap gap-2">
                <label className={`btn btn-outline btn-sm ${logoSaving ? "btn-disabled" : ""}`}>
                  <ArrowUpTrayIcon className="size-4" />
                  Logo PNG
                  <input type="file" accept="image/png" className="hidden" disabled={logoSaving} onChange={(event) => void uploadLogo(event.target.files?.[0] ?? null)} />
                </label>
                <button type="button" className="btn btn-ghost btn-sm text-error" onClick={deleteLogo} disabled={logoSaving || !payload.logo}>
                  <TrashIcon className="size-4" />
                  Eliminar
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-base-300 bg-base-100 p-4">
          <h2 className="text-lg font-semibold">Servicio tecnico</h2>
          <label className="form-control mt-4 max-w-xs">
            <span className="label-text">Alerta de retiro</span>
            <input type="number" min={0} className="input input-bordered" value={form.servicePickupAlertDays} onChange={(event) => setField("servicePickupAlertDays", Number(event.target.value))} />
            <span className="label-text-alt">Dias desde recepcion.</span>
          </label>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-base-300 bg-base-100 p-4">
          <h2 className="text-lg font-semibold">Stock y alertas</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <label className="form-control">
              <span className="label-text">Rotacion alta</span>
              <input type="number" min={0} className="input input-bordered" value={form.stockRotationHighMaxDays} onChange={(event) => setField("stockRotationHighMaxDays", Number(event.target.value))} />
            </label>
            <label className="form-control">
              <span className="label-text">Rotacion media</span>
              <input type="number" min={0} className="input input-bordered" value={form.stockRotationMediumMaxDays} onChange={(event) => setField("stockRotationMediumMaxDays", Number(event.target.value))} />
            </label>
            <label className="form-control">
              <span className="label-text">Accesorio bajo</span>
              <input type="number" min={0} className="input input-bordered" value={form.accessoryLowStockThreshold} onChange={(event) => setField("accessoryLowStockThreshold", Number(event.target.value))} />
            </label>
          </div>
          <div className="mt-4 flex flex-wrap gap-2 text-xs">
            <span className="badge badge-success">Alta: 0-{form.stockRotationHighMaxDays} dias</span>
            <span className="badge badge-warning">Media: {form.stockRotationHighMaxDays + 1}-{form.stockRotationMediumMaxDays} dias</span>
            <span className="badge badge-error">Baja: mas de {form.stockRotationMediumMaxDays} dias</span>
          </div>
        </div>

        <div className="rounded-lg border border-base-300 bg-base-100 p-4">
          <h2 className="text-lg font-semibold">Precios y comisiones</h2>
          <div className="mt-4 grid gap-3">
            <label className="flex items-center justify-between gap-3 rounded-lg border border-base-300 p-3">
              <span>Precios mayoristas</span>
              <input type="checkbox" className="toggle toggle-primary" checked={form.wholesalePricesEnabled} onChange={(event) => setField("wholesalePricesEnabled", event.target.checked)} />
            </label>
            <label className="flex items-center justify-between gap-3 rounded-lg border border-base-300 p-3">
              <span>Comisiones de closer</span>
              <input type="checkbox" className="toggle toggle-primary" checked={form.closerCommissionsEnabled} disabled={commissionDisabled} onChange={(event) => setField("closerCommissionsEnabled", event.target.checked)} />
            </label>
            {commissionDisabled ? (
              <div className="alert alert-warning py-2 text-sm">
                <span>No hay planes activos.</span>
                <Link href="/dashboard/commissions" className="btn btn-xs">Comisiones</Link>
              </div>
            ) : (
              <Link href="/dashboard/commissions" className="btn btn-outline btn-sm w-fit">Comisiones</Link>
            )}
            <div className="grid gap-3 sm:grid-cols-[1fr_160px]">
              <label className="flex items-center justify-between gap-3 rounded-lg border border-base-300 p-3">
                <span>Comision financiera</span>
                <input type="checkbox" className="toggle toggle-primary" checked={form.financialFeeEnabled} onChange={(event) => setField("financialFeeEnabled", event.target.checked)} />
              </label>
              <label className="form-control">
                <span className="label-text">%</span>
                <input type="number" min={0} max={100} step="0.01" className="input input-bordered" value={form.financialFeeRatePct} onChange={(event) => setField("financialFeeRatePct", event.target.value)} />
              </label>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-base-300 bg-base-100 p-4">
        <h2 className="text-lg font-semibold">Legal y garantias</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-[220px_1fr]">
          <label className="form-control">
            <span className="label-text">Garantia usados</span>
            <input type="number" min={0} className="input input-bordered" value={form.usedDeviceWarrantyDays} onChange={(event) => setField("usedDeviceWarrantyDays", Number(event.target.value))} />
            <span className="label-text-alt">Dias.</span>
          </label>
          <label className="form-control">
            <span className="label-text">Politica de garantia</span>
            <textarea className="textarea textarea-bordered min-h-32" value={form.warrantyPolicyText} onChange={(event) => setField("warrantyPolicyText", event.target.value)} />
          </label>
        </div>
      </section>

      {dirty ? (
        <div className="fixed inset-x-0 bottom-0 z-[100] border-t border-base-300 bg-base-100/95 px-4 py-3 shadow-xl backdrop-blur">
          <div className="mx-auto flex max-w-6xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <span className="font-medium">Configuracion sin guardar</span>
            <div className="flex gap-2">
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => form && setForm(JSON.parse(baseline))} disabled={saving}>Descartar</button>
              <button type="button" className="btn btn-primary btn-sm" onClick={save} disabled={saving}>
                {saving ? <span className="loading loading-spinner loading-xs" /> : null}
                Guardar cambios
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
