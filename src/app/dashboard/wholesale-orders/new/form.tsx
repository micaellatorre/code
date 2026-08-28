"use client"

import type { ChangeEvent, FormEvent, ReactNode } from 'react'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import DashboardLayout from '@/components/DashboardLayout'
import Breadcrumbs from '@/components/Breadcrumbs'
import { CONDITION_LABELS, CONDITION_OPTIONS } from '@/lib/products/display'

type WholesaleOrderSuccess = { id?: string }
type WholesaleOrderPayload = {
  customerName: string
  modelName: string
  color: string | null
  capacityGB: number | null
  condition: string | null
  units: number
  unitCostRef: number | null
  unitPriceRef: number | null
  notes: string | null
}

type NewWholesaleOrderFormProps = {
  presentation?: "page" | "dialog"
  formId?: string
  hideActions?: boolean
  onSuccess?: (payload: WholesaleOrderSuccess) => void
  onCancel?: () => void
  onSubmittingChange?: (submitting: boolean) => void
}

export default function NewWholesaleOrderForm({ presentation = "page", formId, hideActions = false, onSuccess, onCancel, onSubmittingChange }: NewWholesaleOrderFormProps) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [form, setForm] = useState({
    customerName: '',
    modelName: '',
    color: '',
    capacityGB: '',
    condition: '',
    units: '1',
    unitCostRef: '',
    unitPriceRef: '',
    notes: '',
  })

  useEffect(() => {
    onSubmittingChange?.(isSaving)
  }, [isSaving, onSubmittingChange])

  function renderChrome(children: ReactNode) {
    if (presentation === "dialog") return <>{children}</>

    return (
      <DashboardLayout>
        <Breadcrumbs
          items={[
            { label: 'Inicio', href: '/' },
            { label: 'Pedidos Mayoristas', href: '/dashboard/wholesale-orders' },
            { label: 'Nuevo Pedido' },
          ]}
        />
        {children}
      </DashboardLayout>
    )
  }
  const isDialog = presentation === "dialog"

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    const payload: WholesaleOrderPayload = {
      customerName: form.customerName,
      modelName: form.modelName,
      color: form.color || null,
      capacityGB: form.capacityGB ? parseInt(form.capacityGB) : null,
      condition: form.condition || null,
      units: parseInt(form.units) || 1,
      unitCostRef: form.unitCostRef ? parseFloat(form.unitCostRef) : null,
      unitPriceRef: form.unitPriceRef ? parseFloat(form.unitPriceRef) : null,
      notes: form.notes || null,
    }
    setIsSaving(true)
    setError(null)
    const res = await fetch('/api/wholesale-orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    setIsSaving(false)
    if (res.ok) {
      const responsePayload = await res.json().catch(() => ({}))
      if (onSuccess) {
        onSuccess(responsePayload)
      } else {
        router.push('/dashboard/wholesale-orders')
        router.refresh()
      }
    } else {
      const responsePayload = await res.json().catch(() => null)
      setError(responsePayload?.error ?? 'Error al crear pedido')
    }
  }

  return renderChrome(
      <div className="max-w-md mx-auto">
        {!isDialog ? <h2 className="text-2xl font-bold mb-6">Nuevo Pedido Mayorista</h2> : null}
        {error ? <div className="alert alert-error mb-4 text-sm">{error}</div> : null}
        <form id={formId} onSubmit={handleSubmit} className="space-y-4">
          <div className="form-control">
            <label className="label"><span className="label-text">Cliente</span></label>
            <input type="text" name="customerName" value={form.customerName} onChange={handleChange} required className="input input-bordered" />
          </div>
          <div className="form-control">
            <label className="label"><span className="label-text">Modelo</span></label>
            <input type="text" name="modelName" value={form.modelName} onChange={handleChange} required className="input input-bordered" />
          </div>
          <div className="form-control">
            <label className="label"><span className="label-text">Color</span></label>
            <input type="text" name="color" value={form.color} onChange={handleChange} className="input input-bordered" />
          </div>
          <div className="form-control">
            <label className="label"><span className="label-text">Capacidad (GB)</span></label>
            <input type="number" name="capacityGB" value={form.capacityGB} onChange={handleChange} className="input input-bordered" />
          </div>
          <div className="form-control">
            <label className="label"><span className="label-text">Condición</span></label>
            <select name="condition" value={form.condition} onChange={handleChange} className="select select-bordered">
              <option value="">Seleccionar</option>
              {CONDITION_OPTIONS.map((condition) => (
                <option key={condition} value={condition}>{CONDITION_LABELS[condition]}</option>
              ))}
            </select>
          </div>
          <div className="form-control">
            <label className="label"><span className="label-text">Unidades</span></label>
            <input type="number" name="units" min="1" value={form.units} onChange={handleChange} className="input input-bordered" />
          </div>
          <div className="form-control">
            <label className="label"><span className="label-text">Costo unitario ref. (USD)</span></label>
            <input type="number" step="0.01" name="unitCostRef" value={form.unitCostRef} onChange={handleChange} className="input input-bordered" />
          </div>
          <div className="form-control">
            <label className="label"><span className="label-text">Precio unitario ref. (USD)</span></label>
            <input type="number" step="0.01" name="unitPriceRef" value={form.unitPriceRef} onChange={handleChange} className="input input-bordered" />
          </div>
          <div className="form-control">
            <label className="label"><span className="label-text">Notas</span></label>
            <input type="text" name="notes" value={form.notes} onChange={handleChange} className="input input-bordered" />
          </div>
          {!hideActions ? (
            <div className="flex flex-col gap-2">
              <button type="submit" className="btn btn-primary w-full mt-4" disabled={isSaving}>{isSaving ? 'Creando...' : 'Crear Pedido'}</button>
              {onCancel ? (
                <button type="button" className="btn btn-ghost w-full" onClick={onCancel} disabled={isSaving}>
                  Cancelar
                </button>
              ) : null}
            </div>
          ) : null}
        </form>
      </div>,
  )
}
