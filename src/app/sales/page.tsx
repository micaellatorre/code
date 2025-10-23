import Link from 'next/link'
import DashboardLayout from '@/components/DashboardLayout'
import Breadcrumbs from '@/components/Breadcrumbs'
import SearchBar from '@/components/SearchBar'
import FilterableSalesTable from '@/components/FilterableSalesTable'
import { prisma } from '@/lib/prisma'

// Force server rendering for sales listing to keep data fresh and consistent
export const dynamic = 'force-dynamic'
/**
 * Listado de ventas.
 * Se beneficia del layout compartido y ofrece un campo de búsqueda.
 */
export default async function SalesPage() {
  const sales = await prisma.sale.findMany({ orderBy: { date: 'desc' }, include: { payments: true } })

  const serialized = sales.map((s) => ({
    ...s,
    date: s.date ? s.date.toISOString() : null,
    subtotal: s.subtotal != null ? String(s.subtotal) : null,
    extraCosts: s.extraCosts != null ? String(s.extraCosts) : null,
    total: s.total != null ? String(s.total) : null,
    profit: s.profit != null ? String(s.profit) : null,
    createdAt: s.createdAt ? s.createdAt.toISOString() : null,
    // pick first payment method if payments were created; keep null otherwise
    payment: s.payments && s.payments.length > 0 ? s.payments[0].method : null,
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