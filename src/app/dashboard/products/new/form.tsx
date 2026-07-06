"use client"

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import DashboardLayout from '@/components/DashboardLayout'
import Breadcrumbs from '@/components/Breadcrumbs'
import BranchAutocomplete, { type BranchOption } from '@/components/branches/BranchAutocomplete'

export const dynamic = 'force-dynamic'

export default function NewProductForm() {
  const router = useRouter()
  const { data: session } = useSession()
  const isAdmin = session?.user?.activeRole === "ADMIN"
  const [branches, setBranches] = useState<BranchOption[]>([])
  const [currentBranch, setCurrentBranch] = useState<BranchOption | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({
    modelName: '',
    location: '',
    branchId: '',
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
    fetch('/api/users/me/branches')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        setBranches(data?.branches ?? [])
        setCurrentBranch(data?.currentBranch ?? null)
        if (data?.currentBranch) setForm((prev) => ({ ...prev, branchId: prev.branchId || data.currentBranch.id }))
      })
  }, [])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target
    const checked = type === "checkbox" ? (e.target as HTMLInputElement).checked : undefined
    setForm((prev) => ({ ...prev, [name]: type === "checkbox" ? checked : value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError(null)
    const payload: any = {
      modelName: form.modelName,
      location: form.location || null,
      branchId: form.branchId || null,
      origin: form.origin || null,
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
      senado: form.senado,
      notes: form.notes || null,
    }
    const res = await fetch('/api/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    try {
      if (res.ok) {
        router.push('/dashboard/products')
      } else {
        const payload = await res.json().catch(() => null)
        setError(payload?.error ?? 'Error al crear producto')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <DashboardLayout >
      <Breadcrumbs
        items={[
          { label: 'Inicio', href: '/' },
          { label: 'Productos', href: '/dashboard/products' },
          { label: 'Nuevo Producto' },
        ]}
      />
      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-4 p-4">
        {error ? <div className="alert alert-error lg:col-span-3 text-sm">{error}</div> : null}
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
                <input type="text" name="location" value={form.location} onChange={handleChange} className="input input-bordered" />
                <span className="label-text-alt mt-1 text-base-content/50 italic">Fallback legacy si no se elige sucursal</span>
              </div>
            </div>
            <div className='flex flex-row w-full gap-4'>
              <div className="form-control w-full">
                {isAdmin ? (
                  <>
                    <BranchAutocomplete value={form.branchId || null} branches={branches} onChange={(branchId) => setForm((prev) => ({ ...prev, branchId }))} />
                    <span className="label-text-alt mt-1 text-base-content/50">Ubicacion fisica inicial del producto.</span>
                  </>
                ) : (
                  <>
                    <label className="label"><span className="label-text">Sucursal</span></label>
                    <div className="rounded-lg border border-base-300 bg-base-200 px-3 py-2 text-sm">{currentBranch?.name ?? "Sin sucursal actual"}</div>
                  </>
                )}
              </div>
            </div>
            <div className='flex flex-row w-full gap-4'>
              <div className="form-control w-full">
                <label className="label"><span className="label-text">Origen</span></label>
                <input type="text" name="origin" value={form.origin} onChange={handleChange} required className="input input-bordered" />
                <span className="label-text-alt mt-1 text-base-content/50 italic">Ej: "Alex", "MercadoLibre", "Cambio Apple", "Plan Canje", etc.</span>
              </div>
              <div className="form-control w-full">
                <label className="label"><span className="label-text">Modelo</span></label>
                <input type="text" name="modelName" value={form.modelName} onChange={handleChange} required className="input input-bordered" />
                <span className="label-text-alt mt-1 text-base-content/50 italic">Ej: "iPhone 15 Pro", "Funda 14 Pro Max"</span>
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
        <div className="card bg-base-100 border border-base-content/50 max-h-fit">
          <div className="card-body">
            <div className="card-actions">
              <button type="submit" className={`btn btn-primary w-full mt-2`} disabled={isSubmitting}>
                {isSubmitting ? <>Creando<span className="loading loading-bars loading-xs"></span></> : 'Crear Producto'}
              </button>
            </div>
          </div>
        </div>
      </form>
    </DashboardLayout>
  )
}
