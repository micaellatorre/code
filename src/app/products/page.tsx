import DashboardLayout from '@/components/DashboardLayout'
import Link from 'next/link'
import type { Metadata } from 'next'
import Breadcrumbs from '@/components/Breadcrumbs'
import FilterableProductsTable from '@/components/FilterableProductsTable'
import { prisma } from '@/lib/prisma'

// Force this page to be server-rendered on every request because it relies on
// up-to-date DB data and should not be statically prerendered.
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Stock de Productos',
  description: 'Listado y gestión de productos en stock',
}

export default async function ProductsPage() {
  const products = await prisma.product.findMany({ orderBy: { createdAt: 'desc' } })

  // Serialize Decimal and Date values into plain JS types so they can be
  // safely passed into Client Components.
  const serialized = products.map((p) => ({
    ...p,
    imei: p.imei ?? '',
    costPrice: p.costPrice != null ? String(p.costPrice) : null,
    salePrice: p.salePrice != null ? String(p.salePrice) : null,
    shippingCost: p.shippingCost != null ? String(p.shippingCost) : null,
    purchaseDate: p.purchaseDate ? p.purchaseDate.toISOString() : null,
    createdAt: p.createdAt ? p.createdAt.toISOString() : null,
    updatedAt: p.updatedAt ? p.updatedAt.toISOString() : null,
    notes: p.notes ?? '',
  }))

  return (
    <DashboardLayout activeTab="products">
      <Breadcrumbs items={[{ label: 'Inicio', href: '/' }, { label: 'Productos' }]} />
      <div className="flex flex-col gap-4 h-full">
        <FilterableProductsTable products={serialized} />
      </div>
    </DashboardLayout>
  )
}
