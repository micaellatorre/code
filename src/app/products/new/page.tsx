"use client"

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import DashboardLayout from '@/components/DashboardLayout'
import Breadcrumbs from '@/components/Breadcrumbs'

// New product page should be server-rendered to avoid stale data and ensure
// any server-side checks run on each request.
export const dynamic = 'force-dynamic'

/**
 * Página para crear un nuevo producto.
 * Se apoya en DaisyUI para darle estilo al formulario y utiliza el layout
 * común del dashboard para mantener la navegación coherente.
 */
export default function NewProductPage() {
  const router = useRouter()
  const [form, setForm] = useState({
    modelName: '',
    brand: '',
    imei: '',
    capacityGB: '',
    condition: '',
    color: '',
    batteryPct: '',
    costPrice: '',
    salePrice: '',
    shippingCost: '',
    type: 'PHONE',
    notes: '',
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    const payload: any = {
      modelName: form.modelName,
      brand: form.brand || null,
      imei: form.imei || null,
      capacityGB: form.capacityGB ? Number(form.capacityGB) : null,
      condition: form.condition || null,
      color: form.color || null,
      batteryPct: form.batteryPct ? Number(form.batteryPct) : null,
      costPrice: parseFloat(form.costPrice) || 0,
      salePrice: parseFloat(form.salePrice) || 0,
      shippingCost: form.shippingCost ? parseFloat(form.shippingCost) : null,
      type: form.type,
      notes: form.notes || null,
    }
    const res = await fetch('/api/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    try {
      if (res.ok) {
        router.push('/products')
      } else {
        console.error('Error al crear producto')
      }
    } finally {
      setIsSubmitting(false)
    }
  }
  return (
    <DashboardLayout >
      {/* Breadcrumbs de navegación */}
      <Breadcrumbs
        items={[
          { label: 'Inicio', href: '/' },
          { label: 'Productos', href: '/products' },
          { label: 'Nuevo Producto' },
        ]}
      />
      <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-6 p-4">
        <div className='card bg-base-100 shadow-md lg:col-span-2 grid grid-cols-2'>
        <fieldset className="lg:col-span-1 p-4 space-y-2">
          <h2 className="text-lg font-bold mb-1">1. Datos del producto</h2>
          {/* Tipo */}
          <div className="form-control">
            <label className="label">
              <span className="label-text">Tipo</span>
            </label>
            <select
              name="type"
              value={form.type}
              onChange={handleChange}
              className="select select-bordered"
            >
              <option value="PHONE">Teléfono</option>
              <option value="ACCESSORY">Accesorio</option>
            </select>
          </div>
          {/* Modelo */}
          <div className="form-control">
            <label className="label">
              <span className="label-text">Modelo</span>
            </label>
            <input
              type="text"
              name="modelName"
              value={form.modelName}
              onChange={handleChange}
              required
              className="input input-bordered"
            />
          </div>
          {/* IMEI */}
          <div className="form-control">
            <label className="label">
              <span className="label-text">IMEI</span>
            </label>
            <input
              type="text"
              name="imei"
              value={form.imei}
              onChange={handleChange}
              className="input input-bordered"
            />
          </div>
          {/* Capacidad */}
          <div className="form-control">
            <label className="label">
              <span className="label-text">Capacidad (GB)</span>
            </label>
            <select
              name="capacityGB"
              value={form.capacityGB}
              onChange={handleChange}
              className="select select-bordered"
            >
              <option value="">Seleccionar</option>
              <option value="64">64 GB</option>
              <option value="128">128 GB</option>
              <option value="256">256 GB</option>
              <option value="512">512 GB</option>
              <option value="1024">1024 GB (1 TB)</option>
              <option value="2048">2048 GB (2 TB)</option>
            </select>
          </div>
          {/* Condición */}
          <div className="form-control">
            <label className="label">
              <span className="label-text">Condición</span>
            </label>
            <select
              name="condition"
              value={form.condition}
              onChange={handleChange}
              className="select select-bordered"
            >
              <option value="">Seleccionar</option>
              <option value="A_PLUS">A+</option>
              <option value="OEM">OEM</option>
              <option value="ASIS">ASIS</option>
              <option value="ASIS_PLUS">ASIS+</option>
              <option value="SEALED">Sellado</option>
            </select>
          </div>
          {/* Color */}
          <div className="form-control">
            <label className="label">
              <span className="label-text">Color</span>
            </label>
            <input
              type="text"
              name="color"
              value={form.color}
              onChange={handleChange}
              className="input input-bordered"
            />
          </div>
        </fieldset>
        <fieldset className="lg:col-span-1 p-4 space-y-2">
          {/* % Batería */}
          <div className="form-control">
            <label className="label">
              <span className="label-text">% Batería</span>
            </label>
            <input
              type="number"
              name="batteryPct"
              value={form.batteryPct}
              onChange={handleChange}
              className="input input-bordered"
            />
          </div>
          {/* Costo */}
          <div className="form-control">
            <label className="label">
              <span className="label-text">Costo (USD)</span>
            </label>
            <input
              type="number"
              step="0.01"
              name="costPrice"
              value={form.costPrice}
              onChange={handleChange}
              required
              className="input input-bordered"
            />
          </div>
          {/* Precio de venta */}
          <div className="form-control">
            <label className="label">
              <span className="label-text">Precio de venta (USD)</span>
            </label>
            <input
              type="number"
              step="0.01"
              name="salePrice"
              value={form.salePrice}
              onChange={handleChange}
              required
              className="input input-bordered"
            />
          </div>
          {/* Costo de envío */}
          <div className="form-control">
            <label className="label">
              <span className="label-text">Costo de envío (USD)</span>
            </label>
            <input
              type="number"
              step="0.01"
              name="shippingCost"
              value={form.shippingCost}
              onChange={handleChange}
              className="input input-bordered"
            />
          </div>
          {/* Notas */}
          <div className="form-control">
            <label className="label">
              <span className="label-text">Notas</span>
            </label>
            <textarea
              className="textarea textarea-bordered"
              name="notes"
              value={form.notes}
              onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
            ></textarea>
          </div>
        </fieldset>
        </div>
        <div className="card bg-base-100 shadow-md max-h-fit">
          <div className="card-body">
            <div className="card-actions">
              <button
                type="submit"
                className={`btn btn-primary w-full mt-2`}
                disabled={isSubmitting}
              >
                {isSubmitting ?
                  <>
                    Creando
                    <span className="loading loading-bars loading-xs"></span>
                  </>
                  : 'Crear'}
              </button>
            </div>
          </div>
        </div>
      </form>
    </DashboardLayout >
  )
}