"use client"

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import DashboardLayout from '@/components/DashboardLayout'
import Breadcrumbs from '@/components/Breadcrumbs'

export default function NewWholesaleOrderForm() {
  const router = useRouter()
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

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const payload: any = {
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
    const res = await fetch('/api/wholesale-orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (res.ok) {
      router.push('/dashboard/wholesale-orders')
    } else {
      console.error('Error al crear pedido')
    }
  }

  return (
    <DashboardLayout>
      <Breadcrumbs
        items={[
          { label: 'Inicio', href: '/' },
          { label: 'Pedidos Mayoristas', href: '/dashboard/wholesale-orders' },
          { label: 'Nuevo Pedido' },
        ]}
      />
      <div className="max-w-md mx-auto">
        <h2 className="text-2xl font-bold mb-6">Nuevo Pedido Mayorista</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
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
              <option value="A_PLUS">A+</option>
              <option value="OEM">OEM</option>
              <option value="ASIS">ASIS</option>
              <option value="ASIS_PLUS">ASIS+</option>
              <option value="SEALED">Sellado</option>
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
          <button type="submit" className="btn btn-primary w-full mt-4">Crear Pedido</button>
        </form>
      </div>
    </DashboardLayout>
  )
}
