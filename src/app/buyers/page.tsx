// /buyers/page.tsx
import DashboardLayout from '@/components/DashboardLayout'
import Breadcrumbs from '@/components/Breadcrumbs'
import FilterableBuyersTable from '@/components/FilterableBuyersTable'
import { prisma } from '@/lib/prisma'
import type { Metadata } from 'next'

// SEO
export const metadata: Metadata = {
  title: 'Clientes',
  description: 'Listado y gestión de clientes.',
}

// Fuerza render del lado del servidor y runtime Node (Prisma)
export const dynamic = 'force-dynamic'

// Helper de serialización (evita BigInt/Decimal en cliente)
function toStr(v: any) {
  return v == null ? null : String(v)
}

export default async function ClientsPage() {
  const buyers = await prisma.buyer.findMany({
    orderBy: { createdAt: 'desc' },
    take: 200,
  })

  const serialized = buyers.map((b) => ({
    id: b.id,
    tenantId: b.tenantId,
    name: b.name,
    surname: b.surname,
    dob: b.dob ? b.dob.toISOString() : null,
    phone: b.phone,
    instagram: b.instagram,
    email: b.email,
    cuit: b.cuit,
    dni: b.dni,
    createdAt: b.createdAt ? b.createdAt.toISOString() : null,
    updatedAt: b.updatedAt ? b.updatedAt.toISOString() : null,
  }))

  return (
    <DashboardLayout activeTab="buyers">
      <Breadcrumbs items={[{ label: 'Inicio', href: '/' }, { label: 'Clientes' }]} />
      <div className="flex flex-col gap-4">
        <FilterableBuyersTable initial={serialized} />
      </div>
    </DashboardLayout>
  )
}