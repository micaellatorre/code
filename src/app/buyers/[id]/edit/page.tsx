// src/app/buyers/[id]/edit/page.tsx
"use client"

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import DashboardLayout from '@/components/DashboardLayout'
import Breadcrumbs from '@/components/Breadcrumbs'
import { Buyer } from '@prisma/client'

async function getBuyer(id: string) {
  const buyer = await prisma.buyer.findUnique({
    where: { id },
  })
  if (!buyer) {
    notFound()
  }
  return buyer
}

export default function EditClientPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const [buyer, setBuyer] = useState<Buyer | null>(null)
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
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    getBuyer(params.id).then(data => {
      setBuyer(data)
      setForm({
        name: data.name || '',
        surname: data.surname || '',
        dni: data.dni || '',
        dob: data.dob ? new Date(data.dob).toISOString().split('T')[0] : '',
        phone: data.phone || '',
        instagram: data.instagram || '',
        email: data.email || '',
        cuit: data.cuit || '',
      })
      setIsLoading(false)
    })
  }, [params.id])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    const payload = {
      ...form,
      dob: form.dob ? new Date(form.dob).toISOString() : null,
    }

    try {
      const res = await fetch(`/api/buyers/${params.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        router.push('/buyers');
      } else {
        console.error('Error al actualizar cliente');
      }
    } catch (error) {
        console.error('Error de red:', error);
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isLoading) {
    return (
        <DashboardLayout activeTab="buyers">
            <div className="flex justify-center items-center h-full">
                <span className="loading loading-spinner loading-lg"></span>
            </div>
        </DashboardLayout>
    )
  }

  if (!buyer) {
    return notFound()
  }

  return (
    <DashboardLayout activeTab="buyers">
      <Breadcrumbs
        items={[
          { label: 'Inicio', href: '/' },
          { label: 'Clientes', href: '/buyers' },
          { label: `Editar: ${buyer.name} ${buyer.surname || ''}` },
        ]}
      />
      <div className="max-w-xl mx-auto">
        <h2 className="text-2xl font-bold mb-4">Editar Cliente</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <fieldset className="border border-base-300 p-4 rounded-box">
            <legend className="text-lg font-medium mb-2">1. Información Personal</legend>
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

          <fieldset className="border border-base-300 p-4 rounded-box">
            <legend className="text-lg font-medium mb-2">2. Información de Contacto y Facturación</legend>
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

          <button
            type="submit"
            className={`btn btn-primary w-full mt-2`}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                Guardando
                <span className="loading loading-bars loading-xs"></span>
              </>
            ) : (
              'Guardar Cambios'
            )}
          </button>
        </form>
      </div>
    </DashboardLayout>
  )
}
