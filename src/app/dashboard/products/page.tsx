// app/products/page.tsx (Server Component)
import DashboardLayout from '@/components/DashboardLayout'
import Breadcrumbs from '@/components/Breadcrumbs'
import FilterableProductsTable from '@/components/products/FilterableProductsTable'
import type { Metadata } from 'next'
import { requireRolePage } from '@/lib/auth/auth'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Stock',
  description: 'Listado y gestión de productos en stock',
}

export default async function ProductsPage() {
  await requireRolePage(['ADMIN', 'VENDEDOR', 'STOCK', 'SOCIO'])

  return (
    <DashboardLayout >
      <Breadcrumbs items={[{ label: 'Inicio', href: '/' }, { label: 'Productos' }]} />
      <div className="flex flex-col gap-4 h-full">
        <FilterableProductsTable />
      </div>
    </DashboardLayout>
  )
}
