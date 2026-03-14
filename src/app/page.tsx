import DashboardLayout from '@/components/DashboardLayout'
import DashboardKpiCard from '@/components/DashboardKpiCard'
import prisma from '@/lib/prisma'
import type { Metadata } from 'next'
import { startOfDay, endOfDay } from 'date-fns'
import { toDate } from 'date-fns-tz'
import { AR_TIME_ZONE } from '@/lib/timezone'

export const metadata: Metadata = {
  title: 'Dashboard',
  description: 'Panel de control con métricas clave del negocio',
}

export const dynamic = 'force-dynamic'
/**
 * Página de inicio del sistema.
 * Muestra las métricas clave del negocio en un tablero de tarjetas. La
 * información se calcula en el servidor para evitar exponer lógica de
 * agregación en el cliente.
 */

export default async function HomePage() {
  // Stock total (suma de stock de todos los productos)
  const stockAgg = await prisma.product.aggregate({
    _sum: { stock: true },
  })
  const stockTotal = stockAgg._sum.stock ?? 0

  // Stock de teléfonos (suma de stock de todos los productos de tipo PHONE)
  const stockPhones = await prisma.product.aggregate({
    where: { type: 'PHONE' },
    _sum: { stock: true },
  })
  const stockPhonesTotal = stockPhones._sum.stock ?? 0

  // Stock de accesorios (suma de stock de todos los productos de tipo ACCESSORY)
  const stockAccessories = await prisma.product.aggregate({
    where: { type: 'ACCESSORY' },
    _sum: { stock: true },
  })
  const stockAccessoriesTotal = stockAccessories._sum.stock ?? 0

  // Contadores de entidades para mostrar en el tablero
  const [totalProducts, totalSuppliers, totalPurchases, totalSales, totalCostProfiles, totalWholesaleOrders] =
    await Promise.all([
      prisma.product.count(),
      prisma.supplier.count(),
      prisma.purchase.count(),
      prisma.sale.count(),
      prisma.costProfile.count(),
      prisma.wholesaleOrder.count(),
    ])

  // Inversión en stock (suma de costPrice * stock para productos EN_STOCK)
  const productsEnStock = await prisma.product.findMany({
    where: { state: 'EN_STOCK' },
    select: { costPrice: true, stock: true },
  })
  const inversionEnStock = productsEnStock.reduce(
    (acc, p) => acc + Number(p.costPrice) * p.stock,
    0,
  )

  // Facturación y ganancia del día
  const nowInArgentina = toDate(new Date(), { timeZone: AR_TIME_ZONE })
  const todayStart = startOfDay(nowInArgentina)
  const todayEnd = endOfDay(nowInArgentina)

  const salesToday = await prisma.sale.findMany({
    where: { date: { gte: todayStart, lt: todayEnd } },
    select: { total: true, profit: true },
  })
  const facturacionDia = salesToday.reduce((acc, s) => acc + Number(s.total), 0)
  const gananciaDia = salesToday.reduce((acc, s) => acc + Number(s.profit), 0)

  return (
    <DashboardLayout >
      <h1 className="text-2xl font-bold mb-4">Panel de Control</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        <DashboardKpiCard title="Productos" value={totalProducts} />
        <DashboardKpiCard title="Stock Total" value={`${stockTotal} u.`} />
        <DashboardKpiCard title="Stock Teléfonos" value={`${stockPhonesTotal} u.`} />
        <DashboardKpiCard title="Stock Accesorios" value={`${stockAccessoriesTotal} u.`} />
        <DashboardKpiCard
          title="Inversión En Stock"
          value={`U$D ${inversionEnStock.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
        />

        {/*  */}
        {/* <DashboardKpiCard title="Proveedores" value={totalSuppliers} /> */}
        {/* <DashboardKpiCard title="Compras" value={totalPurchases} /> */}
        {/* <DashboardKpiCard title="Ventas" value={totalSales} /> */}
        {/* <DashboardKpiCard title="Perfiles de Costo" value={totalCostProfiles} /> */}
        {/* <DashboardKpiCard title="Pedidos Mayoristas" value={totalWholesaleOrders} /> */}
        {/* <DashboardKpiCard title="Facturación del día" value={`${facturacionDia.toFixed(2)}`} /> */}
        {/* <DashboardKpiCard title="Ganancia del día" value={`${gananciaDia.toFixed(2)}`} /> */}
      </div>
    </DashboardLayout>
  )
}