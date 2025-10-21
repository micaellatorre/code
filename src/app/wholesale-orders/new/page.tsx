"use client"

import { useState } from 'react'
import { useRouter } from 'next/navigation'

/**
 * Formulario para crear un nuevo pedido mayorista.
 */
export default function NewWholesaleOrderPage() {
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
    // Convertir campos numéricos
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
      router.push('/wholesale-orders')
    } else {
      console.error('Error al crear pedido')
    }
  }

  return (
    <div>
      <h2 className="text-lg font-bold mb-4">Nuevo Pedido Mayorista</h2>
      <form onSubmit={handleSubmit}>
        <label>
          Cliente
          <input type="text" name="customerName" value={form.customerName} onChange={handleChange} required />
        </label>
        <label>
          Modelo
          <input type="text" name="modelName" value={form.modelName} onChange={handleChange} required />
        </label>
        <label>
          Color
          <input type="text" name="color" value={form.color} onChange={handleChange} />
        </label>
        <label>
          Capacidad (GB)
          <input type="number" name="capacityGB" value={form.capacityGB} onChange={handleChange} />
        </label>
        <label>
          Condición
          <select name="condition" value={form.condition} onChange={handleChange}>
            <option value="">Seleccionar</option>
            <option value="A_PLUS">A+</option>
            <option value="OEM">OEM</option>
            <option value="ASIS">ASIS</option>
            <option value="ASIS_PLUS">ASIS+</option>
            <option value="SEALED">Sellado</option>
          </select>
        </label>
        <label>
          Unidades
          <input type="number" name="units" min="1" value={form.units} onChange={handleChange} />
        </label>
        <label>
          Costo unitario ref. (USD)
          <input type="number" step="0.01" name="unitCostRef" value={form.unitCostRef} onChange={handleChange} />
        </label>
        <label>
          Precio unitario ref. (USD)
          <input type="number" step="0.01" name="unitPriceRef" value={form.unitPriceRef} onChange={handleChange} />
        </label>
        <label>
          Notas
          <input type="text" name="notes" value={form.notes} onChange={handleChange} />
        </label>
        <button type="submit">Crear Pedido</button>
      </form>
    </div>
  )
}