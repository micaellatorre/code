import Link from 'next/link'
import DashboardLayout from '@/components/DashboardLayout'
import Breadcrumbs from '@/components/Breadcrumbs'
import SearchBar from '@/components/SearchBar'
import prisma from '@/lib/prisma'
import { formatInTimeZone } from 'date-fns-tz'
import { AR_TIME_ZONE } from '@/lib/timezone'
import { requireRolePageWithFallback } from '@/lib/auth/auth'

/**
 * Listado de pedidos mayoristas (WholesaleOrder).
 * Utiliza el layout del dashboard y añade buscador para mejorar la UX.
 */
export default async function WholesaleOrdersPage() {
  await requireRolePageWithFallback(['ADMIN', 'VENDEDOR'], '/dashboard/wholesale-orders')

  const orders = await prisma.wholesaleOrder.findMany({ orderBy: { requestedAt: 'desc' } })
  return (
    <DashboardLayout>
      {/* Breadcrumbs de navegación */}
      <Breadcrumbs items={[{ label: 'Inicio', href: '/' }, { label: 'Pedidos Mayoristas' }]} />
      <div className="flex flex-col gap-4">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold">Pedidos Mayoristas</h2>
          <Link href="/dashboard/wholesale-orders/new" className="btn btn-primary">
            Nuevo Pedido
          </Link>
        </div>
        {/* La barra de búsqueda se utiliza sin callback para evitar pasar funciones desde el servidor */}
        <SearchBar />
        <div className="overflow-x-auto rounded-box border border-base-content/5 bg-base-100">
          <table className="table table-zebra w-full">
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Modelo</th>
                <th>Unidades</th>
                <th>Fecha</th>
                <th>Precio Ref. (USD)</th>
                <th>Costo Ref. (USD)</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id}>
                  <td>{o.customerName}</td>
                  <td>{o.modelName}</td>
                  <td>{o.units}</td>
                  <td>{formatInTimeZone(o.requestedAt, AR_TIME_ZONE, 'dd/MM/yyyy')}</td>
                  <td>{o.unitPriceRef ? Number(o.unitPriceRef).toFixed(2) : '-'}</td>
                  <td>{o.unitCostRef ? Number(o.unitCostRef).toFixed(2) : '-'}</td>
                  <td>{o.status}</td>
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