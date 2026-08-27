import { Suspense } from 'react'
import { requireRolePage } from '@/lib/auth/auth'
import NewSaleForm from './form'

export default async function NewSalePage() {
  await requireRolePage(['ADMIN', 'VENDEDOR'])
  return (
    <Suspense fallback={<div className="p-6">Cargando formulario...</div>}>
      <NewSaleForm />
    </Suspense>
  )
}
