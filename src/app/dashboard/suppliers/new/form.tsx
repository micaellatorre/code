"use client"

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import DashboardLayout from '@/components/DashboardLayout'
import Breadcrumbs from '@/components/Breadcrumbs'

export default function NewSupplierForm() {
  const router = useRouter()
  const [form, setForm] = useState({
    name: '',
    contactName: '',
    phone: '',
    email: '',
  })

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const res = await fetch('/api/suppliers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    if (res.ok) {
      router.push('/dashboard/suppliers')
    } else {
      console.error('Error al crear proveedor')
    }
  }

  return (
    <DashboardLayout>
      <Breadcrumbs
        items={[
          { label: 'Inicio', href: '/' },
          { label: 'Proveedores', href: '/dashboard/suppliers' },
          { label: 'Nuevo Proveedor' },
        ]}
      />
      <div className="max-w-md mx-auto">
        <h2 className="text-2xl font-bold mb-6">Nuevo Proveedor</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="form-control">
            <label className="label"><span className="label-text">Nombre</span></label>
            <input type="text" name="name" value={form.name} onChange={handleChange} required className="input input-bordered" />
          </div>
          <div className="form-control">
            <label className="label"><span className="label-text">Nombre de contacto</span></label>
            <input type="text" name="contactName" value={form.contactName} onChange={handleChange} className="input input-bordered" />
          </div>
          <div className="form-control">
            <label className="label"><span className="label-text">Teléfono</span></label>
            <input type="text" name="phone" value={form.phone} onChange={handleChange} className="input input-bordered" />
          </div>
          <div className="form-control">
            <label className="label"><span className="label-text">Email</span></label>
            <input type="email" name="email" value={form.email} onChange={handleChange} className="input input-bordered" />
          </div>
          <button type="submit" className="btn btn-primary w-full mt-4">Crear Proveedor</button>
        </form>
      </div>
    </DashboardLayout>
  )
}
