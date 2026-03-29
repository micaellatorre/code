"use client"

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import DashboardLayout from '@/components/DashboardLayout'
import Breadcrumbs from '@/components/Breadcrumbs'

export default function NewCostProfileForm() {
  const router = useRouter()
  const [form, setForm] = useState({
    name: '',
    funda: '',
    templado: '',
    cable: '',
    tarjetaGarantia: '',
    sticker: '',
    envio: '',
    cajita: '',
    bolsita: '',
    comision: '',
    total: '',
  })

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const payload: any = { name: form.name }
    ;[
      'funda', 'templado', 'cable', 'tarjetaGarantia', 'sticker', 'envio', 'cajita', 'bolsita', 'comision', 'total',
    ].forEach((key) => {
      const val = (form as any)[key]
      if (val !== '') { payload[key] = parseFloat(val) }
    })
    const res = await fetch('/api/cost-profiles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (res.ok) {
      router.push('/dashboard/cost-profiles')
    } else {
      console.error('Error al crear perfil de costo')
    }
  }

  return (
    <DashboardLayout >
      <Breadcrumbs
        items={[
          { label: 'Inicio', href: '/' },
          { label: 'Perfiles de Costo', href: '/dashboard/cost-profiles' },
          { label: 'Nuevo Perfil' },
        ]}
      />
      <div className="max-w-xl mx-auto">
        <h2 className="text-2xl font-bold mb-4">Nuevo Perfil de Costo</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <fieldset className="border border-base-300 p-4 rounded-box">
            <legend className="text-lg font-medium mb-2">Datos del perfil</legend>
            <div className="form-control">
              <label className="label"><span className="label-text">Nombre</span></label>
              <input type="text" name="name" value={form.name} onChange={handleChange} required className="input input-bordered" />
            </div>
            {[
              { key: 'funda', label: 'Funda (USD)' },
              { key: 'templado', label: 'Templado (USD)' },
              { key: 'cable', label: 'Cable (USD)' },
              { key: 'tarjetaGarantia', label: 'Tarjeta Garantía (USD)' },
              { key: 'sticker', label: 'Sticker (USD)' },
              { key: 'envio', label: 'Envío (USD)' },
              { key: 'cajita', label: 'Cajita (USD)' },
              { key: 'bolsita', label: 'Bolsita (USD)' },
              { key: 'comision', label: 'Comisión (USD)' },
              { key: 'total', label: 'Total (USD)' },
            ].map(({ key, label }) => (
              <div key={key} className="form-control mt-2">
                <label className="label"><span className="label-text">{label}</span></label>
                <input type="number" step="0.01" name={key} value={(form as any)[key]} onChange={handleChange} className="input input-bordered" />
              </div>
            ))}
          </fieldset>
          <button type="submit" className="btn btn-primary w-full">Crear Perfil</button>
        </form>
      </div>
    </DashboardLayout>
  )
}
