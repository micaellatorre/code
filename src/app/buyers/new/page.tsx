// src/app/buyers/new/page.tsx
"use client"

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import DashboardLayout from '@/components/DashboardLayout'
import Breadcrumbs from '@/components/Breadcrumbs'
import { fromArgDateInputValue } from '@/lib/timezone'

// async function getDefaultTenantId() {
//     const tenant = await prisma.tenant.findFirst({
//         where: { name: 'Default' },
//     });
//     if (!tenant) {
//         // if there is no default tenant, create one
//         const newTenant = await prisma.tenant.create({
//             data: {
//                 name: 'Default',
//             },
//         });
//         return newTenant.id;
//     }
//     return tenant.id;
// }

export default function NewClientPage() {
  const router = useRouter()
  const [form, setForm] = useState({
    name: '',
    surname: '',
    dni: '',
    dob: '',
    phone: '',
    instagram: '',
    email: '',
    cuit: '',
  })
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    const payload = {
      ...form,
      dob: form.dob ? fromArgDateInputValue(form.dob).toISOString() : null,
    }

    try {
      const res = await fetch('/api/buyers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        router.push('/buyers');
      } else {
        console.error('Error al crear cliente');
      }
    } catch (error) {
      console.error('Error de red:', error);
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <DashboardLayout activeTab="buyers">
      <Breadcrumbs
        items={[
          { label: 'Inicio', href: '/' },
          { label: 'Clientes', href: '/buyers' },
          { label: 'Nuevo Cliente' },
        ]}
      />
      <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-6 p-4">
        <fieldset className="card lg:col-span-1 bg-base-100 shadow-md p-4 space-y-2">
          <h2 className="font-bold text-lg mb-1">1. Información Personal</h2>
          <div className="form-control">
            <label className="label"><span className="label-text">Nombre</span></label>
            <input type="text" name="name" value={form.name} onChange={handleChange} required className="input input-bordered" />
          </div>
          <div className="form-control">
            <label className="label"><span className="label-text">Apellido</span></label>
            <input type="text" name="surname" value={form.surname} onChange={handleChange} className="input input-bordered" />
          </div>
          <div className="form-control">
            <label className="label"><span className="label-text">DNI</span></label>
            <input type="text" name="dni" value={form.dni} onChange={handleChange} className="input input-bordered" />
          </div>
          <div className="form-control">
            <label className="label"><span className="label-text">Fecha de Nacimiento</span></label>
            <input type="date" name="dob" value={form.dob} onChange={handleChange} className="input input-bordered" />
          </div>
        </fieldset>

        <fieldset className="card lg:col-span-1 bg-base-100 shadow-md p-4 space-y-2">
          <h2 className="font-bold text-lg mb-1">2. Información de Contacto y Facturación</h2>
          <div className="form-control">
            <label className="label"><span className="label-text">Teléfono</span></label>
            <input type="text" name="phone" value={form.phone} onChange={handleChange} className="input input-bordered" />
          </div>
          <div className="form-control">
            <label className="label"><span className="label-text">Instagram</span></label>
            <input type="text" name="instagram" value={form.instagram} onChange={handleChange} className="input input-bordered" />
          </div>
          <div className="form-control">
            <label className="label"><span className="label-text">Email</span></label>
            <input type="email" name="email" value={form.email} onChange={handleChange} className="input input-bordered" />
          </div>
          <div className="form-control">
            <label className="label"><span className="label-text">CUIT</span></label>
            <input type="text" name="cuit" value={form.cuit} onChange={handleChange} className="input input-bordered" />
          </div>
        </fieldset>
        <div className="card bg-base-100 shadow-md max-h-fit">
          <div className="card-body">
            <div className="card-actions">
              <button
                type="submit"
                className={`btn btn-primary w-full`}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    Creando
                    <span className="loading loading-bars loading-xs"></span>
                  </>
                ) : (
                  'Crear Cliente'
                )}
              </button>
            </div>
          </div>
        </div>
      </form>
    </DashboardLayout>
  )
}
