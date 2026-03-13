import Link from 'next/link'
import DashboardLayout from '@/components/DashboardLayout'
import Breadcrumbs from '@/components/Breadcrumbs'
import SearchBar from '@/components/SearchBar'
import prisma from '@/lib/prisma'
import { formatInTimeZone } from 'date-fns-tz'
import { AR_TIME_ZONE } from '@/lib/timezone'

/**
 * Listado de compras.
 * Incluye buscador y utiliza el diseño común del dashboard para mayor coherencia.
 */
export default async function PurchasesPage() {
  const purchases = await prisma.purchase.findMany({
    include: { supplier: true },
    orderBy: { date: 'desc' },
  })
  return (
    <DashboardLayout activeTab="purchases">
      {/* Breadcrumbs de navegación */}
      <Breadcrumbs items={[{ label: 'Inicio', href: '/' }, { label: 'Compras' }]} />
      <div className="flex flex-col gap-4">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold">Compras</h2>
          <Link href="/purchases/new" className="btn btn-primary">
            Nueva Compra
          </Link>
        </div>
        {/* No se pasa un handler desde el servidor; el componente maneja su propio estado */}
        <SearchBar />
        <div className="overflow-x-auto rounded-box border border-base-content/5 bg-base-100">
          <table className="table table-zebra w-full">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Proveedor</th>
                <th>Total (USD)</th>
              </tr>
            </thead>
            <tbody>
              {purchases.map((p) => (
                <tr key={p.id}>
                  <td>{formatInTimeZone(p.date, AR_TIME_ZONE, 'dd/MM/yyyy')}</td>
                  <td>{p.supplier?.name ?? '-'}</td>
                  <td>{Number(p.totalCost).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {/* Paginación estática */}
          <div className="join mt-4">
            <button className="join-item btn">«</button>
            <button className="join-item btn btn-active">1</button>
            <button className="join-item btn">2</button>
            <button className="join-item btn">»</button>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}