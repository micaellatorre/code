import DashboardLayout from '@/components/DashboardLayout'
import DashboardKpiCard from '@/components/DashboardKpiCard'
import prisma from '@/lib/prisma'
import type { Metadata } from 'next'
import { endOfDay, startOfDay, subDays } from 'date-fns'
import { toDate } from 'date-fns-tz'
import { AR_TIME_ZONE } from '@/lib/timezone'
import { requireRolePage } from '@/lib/auth/auth'
import {
  ArchiveBoxIcon,
  BanknotesIcon,
  BuildingStorefrontIcon,
  ChartBarIcon,
  ClipboardDocumentListIcon,
  CubeIcon,
  ExclamationTriangleIcon,
  ShoppingBagIcon,
  WrenchScrewdriverIcon,
} from '@heroicons/react/24/solid'

export const metadata: Metadata = {
  title: 'Dashboard',
  description: 'Panel de control con métricas clave del negocio',
}

export const dynamic = 'force-dynamic'

function usd(value: number) {
  return `U$D ${value.toLocaleString('de-DE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

function percentDelta(current: number, previous: number) {
  if (previous === 0) return current > 0 ? 100 : 0
  return ((current - previous) / previous) * 100
}

export default async function DashboardPage() {
  const session = await requireRolePage(['ADMIN', 'SOCIO'])

  const isAdmin = session.user.activeRole === 'ADMIN'
  const isSocio = session.user.activeRole === 'SOCIO'

  const nowInArgentina = toDate(new Date(), { timeZone: AR_TIME_ZONE })
  const todayStart = startOfDay(nowInArgentina)
  const todayEnd = endOfDay(nowInArgentina)

  const previousDayStart = startOfDay(subDays(nowInArgentina, 1))
  const previousDayEnd = endOfDay(subDays(nowInArgentina, 1))

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
    salesToday,
    salesPreviousDay,
    productsInRepair,
    productsInTransit,
    criticalStockProducts,
    oldProducts,
    productsForRotation,
  ] = await Promise.all([
    prisma.product.aggregate({
      _sum: { stock: true, stockAvailable: true },
    }),
    prisma.product.aggregate({
      where: { type: 'PHONE' },
      _sum: { stock: true, stockAvailable: true },
    }),
    prisma.product.aggregate({
      where: { type: 'ACCESSORY' },
      _sum: { stock: true, stockAvailable: true },
    }),
    prisma.product.count(),
    prisma.supplier.count(),
    prisma.purchase.count(),
    prisma.sale.count(),
    prisma.costProfile.count(),
    prisma.wholesaleOrder.count(),
    prisma.product.findMany({
      where: { state: 'EN_STOCK' },
      select: {
        id: true,
        modelName: true,
        type: true,
        costPrice: true,
        stock: true,
        stockAvailable: true,
        createdAt: true,
      },
    }),
    prisma.sale.findMany({
      where: {
        date: {
          gte: todayStart,
          lt: todayEnd,
        },
      },
      select: {
        id: true,
        total: true,
        profit: true,
        costTotal: true,
        createdAt: true,
      },
    }),
    prisma.sale.findMany({
      where: {
        date: {
          gte: previousDayStart,
          lt: previousDayEnd,
        },
      },
      select: {
        total: true,
        profit: true,
      },
    }),
    prisma.product.count({
      where: { state: 'EN_REPARACION' },
    }),
    prisma.product.count({
      where: { state: 'EN_CAMINO' },
    }),
    prisma.product.findMany({
      where: {
        stockAvailable: {
          lte: 2,
        },
        state: 'EN_STOCK',
      },
      orderBy: [{ stockAvailable: 'asc' }, { updatedAt: 'desc' }],
      take: 8,
      select: {
        id: true,
        modelName: true,
        type: true,
        stockAvailable: true,
        state: true,
      },
    }),
    prisma.product.findMany({
      where: {
        createdAt: {
          lt: subDays(nowInArgentina, 30),
        },
        status: 'AVAILABLE',
      },
      orderBy: { createdAt: 'asc' },
      take: 8,
      select: {
        id: true,
        modelName: true,
        type: true,
        createdAt: true,
        stockAvailable: true,
      },
    }),
    prisma.product.findMany({
      where: {
        state: 'EN_STOCK',
      },
      orderBy: [{ stockAvailable: 'desc' }, { updatedAt: 'desc' }],
      take: 10,
      select: {
        id: true,
        modelName: true,
        type: true,
        stock: true,
        stockAvailable: true,
        salePrice: true,
        costPrice: true,
      },
    }),
  ])

  const stockTotal = stockAgg._sum.stock ?? 0
  const stockAvailableTotal = stockAgg._sum.stockAvailable ?? 0
  const stockPhonesTotal = stockPhones._sum.stock ?? 0
  const stockAccessoriesTotal = stockAccessories._sum.stock ?? 0
  const stockPhonesAvailable = stockPhones._sum.stockAvailable ?? 0
  const stockAccessoriesAvailable = stockAccessories._sum.stockAvailable ?? 0

  const inventoryValuation = productsEnStock.reduce(
    (acc, product) => acc + Number(product.costPrice) * product.stock,
    0,
  )

  const salesTodayTotal = salesToday.reduce(
    (acc, sale) => acc + Number(sale.total),
    0,
  )

  const salesTodayProfit = salesToday.reduce(
    (acc, sale) => acc + Number(sale.profit),
    0,
  )

  const salesTodayCost = salesToday.reduce(
    (acc, sale) => acc + Number(sale.costTotal),
    0,
  )

  const salesPreviousDayTotal = salesPreviousDay.reduce(
    (acc, sale) => acc + Number(sale.total),
    0,
  )

  const salesPreviousDayProfit = salesPreviousDay.reduce(
    (acc, sale) => acc + Number(sale.profit),
    0,
  )

  const salesDelta = percentDelta(salesTodayTotal, salesPreviousDayTotal)
  const profitDelta = percentDelta(salesTodayProfit, salesPreviousDayProfit)

  const averageTicket =
    salesToday.length > 0 ? salesTodayTotal / salesToday.length : 0

  const alerts = [
    criticalStockProducts.length > 0
      ? {
          id: 'AL-01',
          severity: 'Alta',
          label: `Stock crítico detectado en ${criticalStockProducts.length} producto(s)`,
        }
      : null,
    oldProducts.length > 0
      ? {
          id: 'AL-02',
          severity: 'Media',
          label: `${oldProducts.length} producto(s) con más de 30 días en inventario`,
        }
      : null,
    productsInRepair > 0
      ? {
          id: 'AL-REPAIR',
          severity: 'Media',
          label: `${productsInRepair} equipo(s) actualmente en reparación`,
        }
      : null,
  ].filter(Boolean) as { id: string; severity: string; label: string }[]

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold">Panel de Control</h1>
            <p className="text-sm text-base-content/60">
              {isAdmin
                ? 'Vista gerencial con foco en rentabilidad, stock y salud operativa.'
                : 'Vista de lectura con foco en indicadores consolidados del negocio.'}
            </p>
          </div>

          <div className="text-xs text-base-content/50">
            Corte diario: {todayStart.toLocaleDateString('es-AR')}
          </div>
        </div>

        {alerts.length > 0 ? (
          <div className="rounded-2xl border border-warning/30 bg-warning/10 p-4">
            <div className="mb-3 flex items-center gap-2">
              <ExclamationTriangleIcon className="size-5 text-warning" />
              <h2 className="font-semibold">Alertas de negocio</h2>
            </div>

            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              {alerts.map((alert) => (
                <div
                  key={alert.id}
                  className="rounded-xl border border-base-content/10 bg-base-100 px-4 py-3 text-sm"
                >
                  <div className="font-medium">{alert.id}</div>
                  <div className="text-base-content/70">{alert.label}</div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <DashboardKpiCard
            title="Ventas Totales del Día"
            value={usd(salesTodayTotal)}
            icon={<BanknotesIcon className="size-6" />}
            trend={salesDelta}
            subtitle="Ingresos consolidados del día"
            tone="warning"
          />

          {isAdmin ? (
            <DashboardKpiCard
              title="Utilidad del Día"
              value={usd(salesTodayProfit)}
              icon={<ChartBarIcon className="size-6" />}
              trend={profitDelta}
              subtitle="Ganancia bruta diaria"
              tone="success"
            />
          ) : null}

          {isAdmin ? (
            <DashboardKpiCard
              title="Valuación de Inventario"
              value={usd(inventoryValuation)}
              icon={<ArchiveBoxIcon className="size-6" />}
              subtitle="Capital inmovilizado en stock"
              tone="info"
            />
          ) : null}

          <DashboardKpiCard
            title="Stock Disponible"
            value={`${stockAvailableTotal} u.`}
            icon={<CubeIcon className="size-6" />}
            subtitle="Unidades listas para operar"
            tone="default"
          />

          <DashboardKpiCard
            title="Equipos en Reparación"
            value={productsInRepair}
            icon={<WrenchScrewdriverIcon className="size-6" />}
            subtitle="Control técnico actual"
            tone={productsInRepair > 0 ? 'warning' : 'default'}
          />

          <DashboardKpiCard
            title="Logística en Tránsito"
            value={productsInTransit}
            icon={<BuildingStorefrontIcon className="size-6" />}
            subtitle="Equipos marcados EN_CAMINO"
            tone="info"
          />

          <DashboardKpiCard
            title="Ticket Promedio del Día"
            value={usd(averageTicket)}
            icon={<ShoppingBagIcon className="size-6" />}
            subtitle="Promedio por venta cerrada hoy"
            tone="default"
          />

          <DashboardKpiCard
            title="Productos Registrados"
            value={totalProducts}
            icon={<ClipboardDocumentListIcon className="size-6" />}
            subtitle="Catálogo total cargado"
            tone="default"
          />
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <div className="rounded-2xl border border-base-content/10 bg-base-100 p-5 xl:col-span-2">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="font-semibold">Resumen operativo</h2>
                <p className="text-sm text-base-content/60">
                  Estado actual del inventario y actividad diaria
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-xl bg-base-200 p-4">
                <div className="text-xs uppercase tracking-wide text-base-content/50">
                  Stock total
                </div>
                <div className="mt-2 text-2xl font-semibold">{stockTotal}</div>
              </div>

              <div className="rounded-xl bg-base-200 p-4">
                <div className="text-xs uppercase tracking-wide text-base-content/50">
                  Teléfonos
                </div>
                <div className="mt-2 text-2xl font-semibold">{stockPhonesTotal}</div>
                <div className="mt-1 text-xs text-base-content/50">
                  Disponibles: {stockPhonesAvailable}
                </div>
              </div>

              <div className="rounded-xl bg-base-200 p-4">
                <div className="text-xs uppercase tracking-wide text-base-content/50">
                  Accesorios
                </div>
                <div className="mt-2 text-2xl font-semibold">{stockAccessoriesTotal}</div>
                <div className="mt-1 text-xs text-base-content/50">
                  Disponibles: {stockAccessoriesAvailable}
                </div>
              </div>

              <div className="rounded-xl bg-base-200 p-4">
                <div className="text-xs uppercase tracking-wide text-base-content/50">
                  Ventas hoy
                </div>
                <div className="mt-2 text-2xl font-semibold">{salesToday.length}</div>
                <div className="mt-1 text-xs text-base-content/50">
                  Costo asociado: {usd(salesTodayCost)}
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-base-content/10 bg-base-100 p-5">
            <h2 className="font-semibold">Métricas del sistema</h2>
            <p className="mt-1 text-sm text-base-content/60">
              Conteos generales del entorno operativo
            </p>

            <div className="mt-4 space-y-3 text-sm">
              <div className="flex items-center justify-between rounded-xl bg-base-200 px-4 py-3">
                <span>Proveedores</span>
                <span className="font-semibold">{totalSuppliers}</span>
              </div>
              <div className="flex items-center justify-between rounded-xl bg-base-200 px-4 py-3">
                <span>Compras</span>
                <span className="font-semibold">{totalPurchases}</span>
              </div>
              <div className="flex items-center justify-between rounded-xl bg-base-200 px-4 py-3">
                <span>Ventas</span>
                <span className="font-semibold">{totalSales}</span>
              </div>
              <div className="flex items-center justify-between rounded-xl bg-base-200 px-4 py-3">
                <span>Cost Profiles</span>
                <span className="font-semibold">{totalCostProfiles}</span>
              </div>
              <div className="flex items-center justify-between rounded-xl bg-base-200 px-4 py-3">
                <span>Pedidos mayoristas</span>
                <span className="font-semibold">{totalWholesaleOrders}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <div className="rounded-2xl border border-base-content/10 bg-base-100 p-5">
            <h2 className="font-semibold">Stock crítico</h2>
            <p className="mt-1 text-sm text-base-content/60">
              Productos con disponibilidad baja
            </p>

            <div className="mt-4 overflow-hidden rounded-xl border border-base-content/10">
              <table className="table table-sm">
                <thead>
                  <tr>
                    <th>Modelo</th>
                    <th>Tipo</th>
                    <th className="text-right">Disponible</th>
                  </tr>
                </thead>
                <tbody>
                  {criticalStockProducts.length > 0 ? (
                    criticalStockProducts.map((product) => (
                      <tr key={product.id}>
                        <td>{product.modelName}</td>
                        <td>{product.type}</td>
                        <td className="text-right font-semibold text-warning">
                          {product.stockAvailable}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={3} className="text-center text-base-content/50">
                        Sin alertas de stock crítico.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-2xl border border-base-content/10 bg-base-100 p-5">
            <h2 className="font-semibold">Aging de inventario</h2>
            <p className="mt-1 text-sm text-base-content/60">
              Productos con más de 30 días en inventario
            </p>

            <div className="mt-4 overflow-hidden rounded-xl border border-base-content/10">
              <table className="table table-sm">
                <thead>
                  <tr>
                    <th>Modelo</th>
                    <th>Tipo</th>
                    <th>Fecha alta</th>
                    <th className="text-right">Disponible</th>
                  </tr>
                </thead>
                <tbody>
                  {oldProducts.length > 0 ? (
                    oldProducts.map((product) => (
                      <tr key={product.id}>
                        <td className="font-medium text-error">{product.modelName}</td>
                        <td>{product.type}</td>
                        <td>{product.createdAt.toLocaleDateString('es-AR')}</td>
                        <td className="text-right">{product.stockAvailable}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="text-center text-base-content/50">
                        No hay productos venciendo el umbral de aging.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {isAdmin ? (
          <div className="rounded-2xl border border-base-content/10 bg-base-100 p-5">
            <h2 className="font-semibold">Ranking simple de rotación / exposición</h2>
            <p className="mt-1 text-sm text-base-content/60">
              Base provisional hasta sumar BI real por sell-through y períodos comparados
            </p>

            <div className="mt-4 overflow-hidden rounded-xl border border-base-content/10">
              <table className="table table-sm">
                <thead>
                  <tr>
                    <th>Modelo</th>
                    <th>Tipo</th>
                    <th className="text-right">Stock</th>
                    <th className="text-right">Disponible</th>
                    <th className="text-right">Costo</th>
                    <th className="text-right">Venta</th>
                    <th className="text-right">Margen unitario</th>
                  </tr>
                </thead>
                <tbody>
                  {productsForRotation.map((product) => {
                    const cost = Number(product.costPrice)
                    const sale = Number(product.salePrice)
                    const margin = sale - cost

                    return (
                      <tr key={product.id}>
                        <td>{product.modelName}</td>
                        <td>{product.type}</td>
                        <td className="text-right">{product.stock}</td>
                        <td className="text-right">{product.stockAvailable}</td>
                        <td className="text-right">{usd(cost)}</td>
                        <td className="text-right">{usd(sale)}</td>
                        <td className={`text-right font-medium ${margin >= 0 ? 'text-success' : 'text-error'}`}>
                          {usd(margin)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
      </div>
    </DashboardLayout>
  )
}