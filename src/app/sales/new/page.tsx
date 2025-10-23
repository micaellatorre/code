"use client"

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import DashboardLayout from '@/components/DashboardLayout'
import Breadcrumbs from '@/components/Breadcrumbs'

interface Product {
  id: string
  modelName: string
  costPrice: any
}

export default function NewSalePage() {
  const router = useRouter()
  const [products, setProducts] = useState<Product[]>([])
  const [form, setForm] = useState({
    customerName: '',
    origin: '',
    payment: '',
    notes: '',
  })
  const [items, setItems] = useState<{
    productId: string
    units: number
    unitPrice: number
    unitCost: number
    extraCost?: number
  }[]>([])
  const [itemForm, setItemForm] = useState({ productId: '', units: '', unitPrice: '', unitCost: '', extraCost: '' })

  useEffect(() => {
    async function fetchData() {
      const prodRes = await fetch('/api/products')
      if (prodRes.ok) {
        setProducts(await prodRes.json())
      }
    }
    fetchData()
  }, [])

  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  const handleItemChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setItemForm((prev) => ({ ...prev, [name]: value }))
  }

  const addItem = () => {
    if (!itemForm.productId || !itemForm.units || !itemForm.unitPrice || !itemForm.unitCost) return
    setItems((prev) => [
      ...prev,
      {
        productId: itemForm.productId,
        units: Number(itemForm.units),
        unitPrice: Number(itemForm.unitPrice),
        unitCost: Number(itemForm.unitCost),
        extraCost: itemForm.extraCost ? Number(itemForm.extraCost) : 0,
      },
    ])
    setItemForm({ productId: '', units: '', unitPrice: '', unitCost: '', extraCost: '' })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const payload = {
      customerName: form.customerName || null,
      origin: form.origin || null,
      payment: form.payment || null,
      notes: form.notes || null,
      items,
    }
    const res = await fetch('/api/sales', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (res.ok) {
      router.push('/sales')
    } else {
      console.error('Error al crear venta')
    }
  }

  return (
    <DashboardLayout activeTab="sales">
      {/* Breadcrumbs de navegación */}
      <Breadcrumbs
        items={[
          { label: 'Inicio', href: '/' },
          { label: 'Ventas', href: '/sales' },
          { label: 'Nueva Venta' },
        ]}
      />
      <div className="max-w-xl mx-auto">
        <h2 className="text-2xl font-bold mb-4">Nueva Venta</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <fieldset className="border border-base-300 p-4 rounded-box">
            <legend className="text-lg font-medium mb-2">Datos de la venta</legend>
            <div className="form-control">
              <label className="label">
                <span className="label-text">Cliente</span>
              </label>
              <input
                type="text"
                name="customerName"
                value={form.customerName}
                onChange={handleFormChange}
                className="input input-bordered"
              />
            </div>
            <div className="form-control">
              <label className="label">
                <span className="label-text">Origen</span>
              </label>
              <input
                type="text"
                name="origin"
                value={form.origin}
                onChange={handleFormChange}
                className="input input-bordered"
              />
            </div>
            <div className="form-control">
              <label className="label">
                <span className="label-text">Medio de pago</span>
              </label>
              <select
                name="payment"
                value={form.payment}
                onChange={handleFormChange}
                className="select select-bordered"
              >
                <option value="">Seleccionar</option>
                <option value="EFECTIVO_PESOS">Efectivo Pesos</option>
                <option value="EFECTIVO_USD">Efectivo USD</option>
                <option value="TRANSFERENCIA_ARS">Transferencia ARS</option>
                <option value="TRANSFERENCIA_USD">Transferencia USD</option>
                <option value="TARJETA">Tarjeta</option>
                <option value="USDT">USDT</option>
              </select>
            </div>
            <div className="form-control">
              <label className="label">
                <span className="label-text">Notas</span>
              </label>
              <input
                type="text"
                name="notes"
                value={form.notes}
                onChange={handleFormChange}
                className="input input-bordered"
              />
            </div>
          </fieldset>
          <fieldset className="border border-base-300 p-4 rounded-box">
            <legend className="text-lg font-medium mb-2">Items</legend>
            <div className="space-y-2">
              <div className="form-control">
                <label className="label">
                  <span className="label-text">Producto</span>
                </label>
                <select
                  name="productId"
                  value={itemForm.productId}
                  onChange={handleItemChange}
                  className="select select-bordered"
                >
                  <option value="">Seleccionar</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.modelName}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-control">
                <label className="label">
                  <span className="label-text">Unidades</span>
                </label>
                <input
                  type="number"
                  name="units"
                  value={itemForm.units}
                  onChange={handleItemChange}
                  className="input input-bordered"
                />
              </div>
              <div className="form-control">
                <label className="label">
                  <span className="label-text">Precio unitario (USD)</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  name="unitPrice"
                  value={itemForm.unitPrice}
                  onChange={handleItemChange}
                  className="input input-bordered"
                />
              </div>
              <div className="form-control">
                <label className="label">
                  <span className="label-text">Costo unitario (USD)</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  name="unitCost"
                  value={itemForm.unitCost}
                  onChange={handleItemChange}
                  className="input input-bordered"
                />
              </div>
              <div className="form-control">
                <label className="label">
                  <span className="label-text">Costo extra unitario (USD)</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  name="extraCost"
                  value={itemForm.extraCost}
                  onChange={handleItemChange}
                  className="input input-bordered"
                />
              </div>
              <button type="button" onClick={addItem} className="btn btn-outline w-full">
                Agregar Ítem
              </button>
            </div>
            {items.length > 0 && (
              <div className="overflow-x-auto rounded-box border border-base-content/5 bg-base-100 mt-4">
                <table className="table table-zebra w-full">
                  <thead>
                    <tr>
                      <th>Producto</th>
                      <th>Unidades</th>
                      <th>Precio unitario</th>
                      <th>Costo unitario</th>
                      <th>Costo extra</th>
                      <th>Total</th>
                      <th>Ganancia</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item, idx) => {
                      const product = products.find((p) => p.id === item.productId)
                      const lineTotal = item.units * item.unitPrice
                      const lineCost = item.units * (item.unitCost + (item.extraCost ?? 0))
                      const lineProfit = lineTotal - lineCost
                      return (
                        <tr key={idx}>
                          <td>{product?.modelName ?? item.productId}</td>
                          <td>{item.units}</td>
                          <td>{item.unitPrice.toFixed(2)}</td>
                          <td>{item.unitCost.toFixed(2)}</td>
                          <td>{(item.extraCost ?? 0).toFixed(2)}</td>
                          <td>{lineTotal.toFixed(2)}</td>
                          <td>{lineProfit.toFixed(2)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </fieldset>
          <button type="submit" className="btn btn-primary w-full mt-2">
            Crear Venta
          </button>
        </form>
      </div>
    </DashboardLayout>
  )
}

// Ensure the new sale page is rendered server-side on each request.
export const dynamic = 'force-dynamic'