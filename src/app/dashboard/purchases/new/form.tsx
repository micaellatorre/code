"use client"

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import DashboardLayout from '@/components/DashboardLayout'
import Breadcrumbs from '@/components/Breadcrumbs'
import { fromArgDateInputValue, toArgDateInputValue } from '@/lib/timezone'

interface Supplier {
  id: string
  name: string
}
interface Product {
  id: string
  modelName: string
  costPrice: any
}

interface NewPurchaseFormProps {
  id?: string
}

export default function NewPurchaseForm() {
  const router = useRouter()
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [form, setForm] = useState({
    supplierId: '',
    date: toArgDateInputValue(new Date()),
    currency: 'USD',
    downPayment: '',
    notes: '',
  })
  const [items, setItems] = useState<{
    productId: string
    units: number
    unitCost: number
  }[]>([])
  const [itemForm, setItemForm] = useState({ productId: '', units: '', unitCost: '' })

  useEffect(() => {
    async function fetchData() {
      const supRes = await fetch('/api/suppliers')
      const prodRes = await fetch('/api/products')
      if (supRes.ok) {
        setSuppliers(await supRes.json())
      }
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
    if (!itemForm.productId || !itemForm.units || !itemForm.unitCost) return
    setItems((prev) => [...prev, { productId: itemForm.productId, units: Number(itemForm.units), unitCost: Number(itemForm.unitCost) }])
    setItemForm({ productId: '', units: '', unitCost: '' })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const totalCost = items.reduce((acc, i) => acc + i.units * i.unitCost, 0)
    const payload = {
      supplierId: form.supplierId,
      date: form.date ? fromArgDateInputValue(form.date).toISOString() : new Date().toISOString(),
      currency: form.currency,
      downPayment: form.downPayment ? Number(form.downPayment) : null,
      totalCost,
      notes: form.notes,
      items,
    }
    const res = await fetch('/api/purchases', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (res.ok) {
      router.push('/dashboard/purchases')
    } else {
      console.error('Error al crear compra')
    }
  }

  return (
    <DashboardLayout >
      <Breadcrumbs
        items={[
          { label: 'Inicio', href: '/' },
          { label: 'Compras', href: '/dashboard/purchases' },
          { label: 'Nueva Compra' },
        ]}
      />
      <div className="max-w-xl mx-auto">
        <h2 className="text-2xl font-bold mb-4">Nueva Compra</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <fieldset className="border border-base-300 p-4 rounded-box">
            <legend className="text-lg font-medium mb-2">Datos de la compra</legend>
            <div className="form-control">
              <label className="label"><span className="label-text">Proveedor</span></label>
              <select name="supplierId" value={form.supplierId} onChange={handleFormChange} required className="select select-bordered">
                <option value="">Seleccionar</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
            <div className="form-control">
              <label className="label"><span className="label-text">Fecha</span></label>
              <input type="date" name="date" value={form.date} onChange={handleFormChange} className="input input-bordered" />
            </div>
            <div className="form-control">
              <label className="label"><span className="label-text">Seña (USD)</span></label>
              <input type="number" step="0.01" name="downPayment" value={form.downPayment} onChange={handleFormChange} className="input input-bordered" />
            </div>
            <div className="form-control">
              <label className="label"><span className="label-text">Moneda</span></label>
              <select name="currency" value={form.currency} onChange={handleFormChange} className="select select-bordered">
                <option value="USD">USD</option>
                <option value="ARS">ARS</option>
                <option value="USDT">USDT</option>
              </select>
            </div>
            <div className="form-control">
              <label className="label"><span className="label-text">Notas</span></label>
              <input type="text" name="notes" value={form.notes} onChange={handleFormChange} className="input input-bordered" />
            </div>
          </fieldset>
          <fieldset className="border border-base-300 p-4 rounded-box">
            <legend className="text-lg font-medium mb-2">Items</legend>
            <div className="space-y-2">
              <div className="form-control">
                <label className="label"><span className="label-text">Producto</span></label>
                <select name="productId" value={itemForm.productId} onChange={handleItemChange} className="select select-bordered">
                  <option value="">Seleccionar</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>{p.modelName}</option>
                  ))}
                </select>
              </div>
              <div className="form-control">
                <label className="label"><span className="label-text">Unidades</span></label>
                <input type="number" name="units" value={itemForm.units} onChange={handleItemChange} className="input input-bordered" />
              </div>
              <div className="form-control">
                <label className="label"><span className="label-text">Costo unitario (USD)</span></label>
                <input type="number" step="0.01" name="unitCost" value={itemForm.unitCost} onChange={handleItemChange} className="input input-bordered" />
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
                      <th>Costo unitario</th>
                      <th>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item, idx) => {
                      const product = products.find((p) => p.id === item.productId)
                      return (
                        <tr key={idx}>
                          <td>{product?.modelName ?? item.productId}</td>
                          <td>{item.units}</td>
                          <td>{item.unitCost.toFixed(2)}</td>
                          <td>{(item.units * item.unitCost).toFixed(2)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </fieldset>
          <button type="submit" className="btn btn-primary w-full mt-2">
            Crear Compra
          </button>
        </form>
      </div>
    </DashboardLayout>
  )
}
