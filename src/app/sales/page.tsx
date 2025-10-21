import Link from 'next/link'
import DashboardLayout from '@/components/DashboardLayout'
import Breadcrumbs from '@/components/Breadcrumbs'
import SearchBar from '@/components/SearchBar'
import FilterableSalesTable from '@/components/FilterableSalesTable'
import { prisma } from '@/lib/prisma'

/**
 * Listado de ventas.
 * Se beneficia del layout compartido y ofrece un campo de búsqueda.
 */
export default async function SalesPage() {
  const sales = await prisma.sale.findMany({ orderBy: { date: 'desc' } })

  const serialized = sales.map((s) => ({
    ...s,
    date: s.date ? s.date.toISOString() : null,
    subtotal: s.subtotal != null ? String(s.subtotal) : null,
    extraCosts: s.extraCosts != null ? String(s.extraCosts) : null,
    total: s.total != null ? String(s.total) : null,
    profit: s.profit != null ? String(s.profit) : null,
    createdAt: s.createdAt ? s.createdAt.toISOString() : null,
  }))

  return (
    <DashboardLayout activeTab="sales">
      {/* Breadcrumbs de navegación */}
      <Breadcrumbs items={[{ label: 'Inicio', href: '/' }, { label: 'Ventas' }]} />
      <div className="flex flex-col gap-4">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold">Ventas</h2>
          <Link href="/sales/new" className="btn btn-primary">
            Nueva Venta
          </Link>
        </div>
        <FilterableSalesTable initial={serialized} />
      </div>
    </DashboardLayout>
  )
}