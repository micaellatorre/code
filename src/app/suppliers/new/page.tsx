"use client"

import { useState } from 'react'
import { useRouter } from 'next/navigation'

/**
 * Página para crear un nuevo proveedor.
 */
export default function NewSupplierPage() {
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
      router.push('/suppliers')
    } else {
      console.error('Error al crear proveedor')
    }
  }

  return (
    <div>
      <h2 className="text-lg font-bold mb-4">Nuevo Proveedor</h2>
      <form onSubmit={handleSubmit}>
        <label>
          Nombre
          <input type="text" name="name" value={form.name} onChange={handleChange} required />
        </label>
        <label>
          Nombre de contacto
          <input type="text" name="contactName" value={form.contactName} onChange={handleChange} />
        </label>
        <label>
          Teléfono
          <input type="text" name="phone" value={form.phone} onChange={handleChange} />
        </label>
        <label>
          Email
          <input type="email" name="email" value={form.email} onChange={handleChange} />
        </label>
        <button type="submit">Crear</button>
      </form>
    </div>
  )
}