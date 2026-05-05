"use client"

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import DashboardLayout from '@/components/DashboardLayout'
import Breadcrumbs from '@/components/Breadcrumbs'

interface EditProductFormProps {
  id: string
}

export default function EditProductForm({ id }: EditProductFormProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({
    modelName: '',
    location: '',
    origin: '',
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
    senado: false,
    notes: '',
  })
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    async function fetchProduct() {
      const res = await fetch(`/api/products/${id}`)
      if (res.ok) {
        const data = await res.json()
        setForm({
          modelName: data.modelName ?? '',
          location: data.location ?? '',
          origin: data.origin ?? '',
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
          senado: Boolean(data.senado),
          notes: data.notes ?? '',
        })
      }
      setLoading(false)
    }
    fetchProduct()
  }, [id])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target
    const checked = type === "checkbox" ? (e.target as HTMLInputElement).checked : undefined
    setForm((prev) => ({ ...prev, [name]: type === "checkbox" ? checked : value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    const payload: any = {
      modelName: form.modelName,
      location: form.location || null,
      origin: form.origin || null,
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
      senado: form.senado,
      notes: form.notes || null,
    }
    const res = await fetch(`/api/products/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    try {
      if (res.ok) {
        router.push('/dashboard/products')
      } else {
        console.error('Error al actualizar producto')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm('¿Eliminar producto?')) return
    const res = await fetch(`/api/products/${id}`, { method: 'DELETE' })
    if (res.ok) {
      router.push('/dashboard/products')
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
      <Breadcrumbs
        items={[
          { label: 'Inicio', href: '/' },
          { label: 'Productos', href: '/dashboard/products' },
          { label: 'Editar Producto' },
        ]}
      />
      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-4 p-4">
        <div className='lg:col-span-2 flex flex-col gap-4'>
          <fieldset className="card bg-base-100 border border-base-content/50 lg:col-span-1 p-4 space-y-2">
            <h2 className="text-lg font-bold mb-1">1. Datos del producto</h2>
            <div className='flex flex-row w-full gap-4'>
              <div className="form-control w-full">
                <label className="label"><span className="label-text">Tipo</span></label>
                <select name="type" value={form.type} onChange={handleChange} className="select select-bordered">
                  <option value="PHONE">Teléfono</option>
                  <option value="ACCESSORY">Accesorio</option>
                </select>
              </div>
              <div className="form-control w-full">
                <label className="label"><span className="label-text">Ubicación</span></label>
                <input type="text" name="location" value={form.location} onChange={handleChange} required className="input input-bordered" />
              </div>
            </div>
            <div className='flex flex-row w-full gap-4'>
              <div className="form-control w-full">
                <label className="label"><span className="label-text">Origen</span></label>
                <input type="text" name="origin" value={form.origin} onChange={handleChange} required className="input input-bordered" />
              </div>
              <div className="form-control w-full">
                <label className="label"><span className="label-text">Modelo</span></label>
                <input type="text" name="modelName" value={form.modelName} onChange={handleChange} required className="input input-bordered" />
              </div>
            </div>
            <div className='flex flex-row w-full gap-4'>
              <div className="form-control w-full">
                <label className="label"><span className="label-text">IMEI</span></label>
                <input type="text" name="imei" value={form.imei} onChange={handleChange} className="input input-bordered" />
              </div>
              <div className="form-control w-full">
                <label className="label"><span className="label-text">Capacidad (GB)</span></label>
                <select name="capacityGB" value={form.capacityGB} onChange={handleChange} className="select select-bordered">
                  <option value="">Seleccionar</option>
                  <option value="64">64 GB</option>
                  <option value="128">128 GB</option>
                  <option value="256">256 GB</option>
                  <option value="512">512 GB</option>
                  <option value="1024">1024 GB (1 TB)</option>
                  <option value="2048">2048 GB (2 TB)</option>
                </select>
              </div>
            </div>
            <div className='flex flex-row w-full gap-4'>
              <div className="form-control w-full">
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
              <div className="form-control w-full">
                <label className="label"><span className="label-text">Color</span></label>
                <input type="text" name="color" value={form.color} onChange={handleChange} className="input input-bordered" />
              </div>
            </div>
            <div className='flex flex-row w-full gap-4'>
              <div className="form-control w-full">
                <label className="label"><span className="label-text">% Batería</span></label>
                <input type="number" name="batteryPct" value={form.batteryPct} onChange={handleChange} className="input input-bordered" />
              </div>
              <div className="form-control w-full">
                <label className="label"><span className="label-text">Costo (USD)</span></label>
                <input type="number" step="0.01" name="costPrice" value={form.costPrice} onChange={handleChange} required className="input input-bordered" />
              </div>
            </div>
            <div className='flex flex-row w-full gap-4'>
              <div className="form-control w-full">
                <label className="label"><span className="label-text">Precio de venta (USD)</span></label>
                <input type="number" step="0.01" name="salePrice" value={form.salePrice} onChange={handleChange} required className="input input-bordered" />
              </div>
              <div className="form-control w-full">
                <label className="label"><span className="label-text">Costo de envío (USD)</span></label>
                <input type="number" step="0.01" name="shippingCost" value={form.shippingCost} onChange={handleChange} className="input input-bordered" />
              </div>
            </div>
            <div className="form-control w-full">
              <label className="label"><span className="label-text">Notas</span></label>
              <textarea className="textarea textarea-bordered" name="notes" value={form.notes} onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}></textarea>
            </div>
            <label className="label cursor-pointer justify-start gap-3">
              <input type="checkbox" name="senado" checked={form.senado} onChange={handleChange} className="checkbox checkbox-sm" />
              <span className="label-text">Producto señado</span>
            </label>
          </fieldset>
        </div>
        <div className="card bg-base-100 border border-base-content/50 max-h-fit p-4 flex flex-col gap-2">
          <button type="submit" className="btn btn-primary w-full" disabled={isSubmitting}>
            {isSubmitting ? <>Guardando<span className="loading loading-bars loading-xs"></span></> : 'Guardar'}
          </button>
          <button type="button" onClick={handleDelete} className="btn btn-error w-full">
            Eliminar
          </button>
        </div>
      </form>
    </DashboardLayout>
  )
}
