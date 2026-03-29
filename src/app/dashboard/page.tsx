import DashboardLayout from '@/components/DashboardLayout'
import DashboardKpiCard from '@/components/DashboardKpiCard'
import prisma from '@/lib/prisma'
import type { Metadata } from 'next'
import { startOfDay, endOfDay } from 'date-fns'
import { toDate } from 'date-fns-tz'
import { AR_TIME_ZONE } from '@/lib/timezone'
import { requireRolePageWithFallback } from '@/lib/auth/auth'

export const metadata: Metadata = {
  title: 'Dashboard',
  description: 'Panel de control con métricas clave del negocio',
}

export const dynamic = 'force-dynamic'

/**
 * Dashboard principal.
 * Acceso permitido:
 * - ADMIN
 * - SOCIO
 *
 * Se protege a nivel server para evitar acceso no autorizado incluso si se intenta
 * ingresar manualmente a la ruta.
 */
export default async function DashboardPage() {
  await requireRolePageWithFallback(['ADMIN', 'SOCIO'], '/dashboard')

  const [
    stockAgg,
    stockPhones,
    stockAccessories,
    totalProducts,
    totalSuppliers,
    totalPurchases,
    totalSales,
    totalCostProfiles,
    totalWholesaleOrders,
    productsEnStock,
  ] = await Promise.all([
    prisma.product.aggregate({
      _sum: { stock: true },
    }),
    prisma.product.aggregate({
      where: { type: 'PHONE' },
      _sum: { stock: true },
    }),
    prisma.product.aggregate({
      where: { type: 'ACCESSORY' },
      _sum: { stock: true },
    }),
    prisma.product.count(),
    prisma.supplier.count(),
    prisma.purchase.count(),
    prisma.sale.count(),
    prisma.costProfile.count(),
    prisma.wholesaleOrder.count(),
    prisma.product.findMany({
      where: { state: 'EN_STOCK' },
      select: { costPrice: true, stock: true },
    }),
  ])

  const stockTotal = stockAgg._sum.stock ?? 0
  const stockPhonesTotal = stockPhones._sum.stock ?? 0
  const stockAccessoriesTotal = stockAccessories._sum.stock ?? 0

  const inversionEnStock = productsEnStock.reduce(
    (acc, product) => acc + Number(product.costPrice) * product.stock,
    0,
  )

  const nowInArgentina = toDate(new Date(), { timeZone: AR_TIME_ZONE })
  const todayStart = startOfDay(nowInArgentina)
  const todayEnd = endOfDay(nowInArgentina)

  const salesToday = await prisma.sale.findMany({
    where: {
      date: {
        gte: todayStart,
        lt: todayEnd,
      },
    },
    select: {
      total: true,
      profit: true,
    },
  })

  const facturacionDia = salesToday.reduce(
    (acc, sale) => acc + Number(sale.total),
    0,
  )

  const gananciaDia = salesToday.reduce(
    (acc, sale) => acc + Number(sale.profit),
    0,
  )

  return (
    <DashboardLayout>
      <h1 className="text-2xl font-bold mb-4">Panel de Control</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        <DashboardKpiCard title="Productos" value={totalProducts} />
        <DashboardKpiCard title="Stock Total" value={`${stockTotal} u.`} />
        <DashboardKpiCard title="Stock Teléfonos" value={`${stockPhonesTotal} u.`} />
        <DashboardKpiCard title="Stock Accesorios" value={`${stockAccessoriesTotal} u.`} />
        <DashboardKpiCard
          title="Inversión En Stock"
          value={`U$D ${inversionEnStock.toLocaleString('de-DE', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}`}
        />

        {/*
        <DashboardKpiCard title="Proveedores" value={totalSuppliers} />
        <DashboardKpiCard title="Compras" value={totalPurchases} />
        <DashboardKpiCard title="Ventas" value={totalSales} />
        <DashboardKpiCard title="Perfiles de Costo" value={totalCostProfiles} />
        <DashboardKpiCard title="Pedidos Mayoristas" value={totalWholesaleOrders} />
        <DashboardKpiCard title="Facturación del día" value={`${facturacionDia.toFixed(2)}`} />
        <DashboardKpiCard title="Ganancia del día" value={`${gananciaDia.toFixed(2)}`} />
        */}
      </div>
    </DashboardLayout>
  )
}