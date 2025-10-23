import DashboardLayout from '@/components/DashboardLayout'
import Link from 'next/link'
import Breadcrumbs from '@/components/Breadcrumbs'
import FilterableProductsTable from '@/components/FilterableProductsTable'
import { prisma } from '@/lib/prisma'

// Force this page to be server-rendered on every request because it relies on
// up-to-date DB data and should not be statically prerendered.
export const dynamic = 'force-dynamic'

export default async function ProductsPage() {
  const products = await prisma.product.findMany({ orderBy: { modelName: 'asc' } })

  // Serialize Decimal and Date values into plain JS types so they can be
  // safely passed into Client Components.
  const serialized = products.map((p) => ({
    ...p,
    costPrice: p.costPrice != null ? String(p.costPrice) : null,
    salePrice: p.salePrice != null ? String(p.salePrice) : null,
    shippingCost: p.shippingCost != null ? String(p.shippingCost) : null,
    purchaseDate: p.purchaseDate ? p.purchaseDate.toISOString() : null,
    createdAt: p.createdAt ? p.createdAt.toISOString() : null,
    updatedAt: p.updatedAt ? p.updatedAt.toISOString() : null,
  }))

  return (
    <DashboardLayout activeTab="products">
      <Breadcrumbs items={[{ label: 'Inicio', href: '/' }, { label: 'Productos' }]} />
      <div className="flex flex-col gap-4 h-full">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold">Productos</h2>
          <Link href="/products/new" className="btn btn-primary">
            Nuevo Producto
          </Link>
        </div>
        <FilterableProductsTable products={serialized} />
      </div>
    </DashboardLayout>
  )
}
