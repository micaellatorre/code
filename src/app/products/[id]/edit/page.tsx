"use client"

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import DashboardLayout from '@/components/DashboardLayout'
import Breadcrumbs from '@/components/Breadcrumbs'

interface EditProductPageProps {
  params: { id: string }
}

/**
 * Página para editar un producto existente.
 */
export default function EditProductPage({ params }: EditProductPageProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
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

  useEffect(() => {
    async function fetchProduct() {
      const res = await fetch(`/api/products/${params.id}`)
      if (res.ok) {
        const data = await res.json()
        setForm({
          modelName: data.modelName ?? '',
          brand: data.brand ?? '',
          imei: data.imei ?? '',
          capacityGB: data.capacityGB ?? '',
          condition: data.condition ?? '',
          color: data.color ?? '',
          batteryPct: data.batteryPct ?? '',
          costPrice: data.costPrice ?? '',
          salePrice: data.salePrice ?? '',
          shippingCost: data.shippingCost ?? '',
          type: data.type,
          notes: data.notes ?? '',
        })
      }
      setLoading(false)
    }
    fetchProduct()
  }, [params.id])

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
      costPrice: parseFloat(String(form.costPrice)) || 0,
      salePrice: parseFloat(String(form.salePrice)) || 0,
      shippingCost: form.shippingCost ? parseFloat(String(form.shippingCost)) : null,
      type: form.type,
      notes: form.notes || null,
    }
    const res = await fetch(`/api/products/${params.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    try {
      if (res.ok) {
        router.push('/products')
      } else {
        console.error('Error al actualizar producto')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm('¿Eliminar producto?')) return
    const res = await fetch(`/api/products/${params.id}`, { method: 'DELETE' })
    if (res.ok) {
      router.push('/products')
    }
  }

  if (loading) {
    return (
      <DashboardLayout >
        <div className="flex justify-center items-center py-10">
          <span className="loading loading-spinner loading-lg"></span>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout >
      {/* Breadcrumbs de navegación */}
      <Breadcrumbs
        items={[
          { label: 'Inicio', href: '/' },
          { label: 'Productos', href: '/products' },
          { label: 'Editar Producto' },
        ]}
      />
      <div className="max-w-xl mx-auto">
        <h2 className="text-2xl font-bold mb-4">Editar Producto</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <fieldset className="border border-base-300 p-4 rounded-box">
            <legend className="text-lg font-medium mb-2">Datos del producto</legend>
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
            {/* <div className="form-control">
              <label className="label">
                <span className="label-text">Marca</span>
              </label>
              <input
                type="text"
                name="brand"
                value={form.brand}
                onChange={handleChange}
                className="input input-bordered"
              />
            </div> */}
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
          <div className="relative flex flex-col gap-4 w-full">
            <button
              type="submit"
              className="btn btn-primary w-full"
              disabled={isSubmitting}>
              {isSubmitting ?
                <>
                  Guardando
                  <span className="loading loading-bars loading-xs"></span>
                </>
                : 'Guardar'}
            </button>
            <button type="button" onClick={handleDelete} className="btn btn-error w-full">
              Eliminar
            </button>
          </div>
        </form>
      </div>
    </DashboardLayout>
  )
}