import DashboardLayout from "@/components/DashboardLayout"
import DashboardOverviewClient from "@/components/dashboard/DashboardOverviewClient"
import type {
  CompareMode,
  DashboardInventoryInsightItem,
  DashboardOverviewData,
  DashboardProductInsightItem,
  DashboardProductType,
  DashboardRange,
  DashboardRevenueTrendPoint,
  DashboardStockCompositionItem,
  DashboardTrendPointDetail,
  DashboardTrendProductSummary,
} from "@/components/dashboard/DashboardTypes"
import { requireRolePage } from "@/lib/auth/auth"
import prisma from "@/lib/prisma"
import { getProductDisplayModel, type ProductCatalogDisplayProduct } from "@/lib/products/display"
import { productCatalogDisplaySelect } from "@/lib/products/selects"
import { AR_TIME_ZONE, fromArgDateInputValue, toArgDateInputValue } from "@/lib/timezone"
import { addDays, differenceInCalendarDays, eachDayOfInterval, subDays, subYears } from "date-fns"
import { formatInTimeZone } from "date-fns-tz"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Dashboard",
  description: "Panel de control con metricas clave del negocio",
}

export const dynamic = "force-dynamic"

const DEFAULT_CRITICAL_STOCK_THRESHOLD = 2
const DEFAULT_AGING_DAYS_THRESHOLD = 30

type DashboardPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

type SaleForTrend = {
  id: string
  date: Date
  total: unknown
  profit: unknown
}

type SaleItemForInsight = {
  units: number
  lineTotal: unknown
  lineProfit: unknown
  sale: { date: Date }
  product: {
    id: string
    modelName: string
    type: DashboardProductType
  } & ProductCatalogDisplayProduct
}

function numberParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

function parseCompare(value: string | string[] | undefined): CompareMode {
  const raw = numberParam(value)
  return raw === "previous" || raw === "yoy" ? raw : "none"
}

function parseDateParam(value: string | string[] | undefined) {
  const raw = numberParam(value)
  if (!raw || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null
  const date = fromArgDateInputValue(raw)
  return Number.isNaN(date.getTime()) ? null : date
}

function asRange(from: Date, to: Date): DashboardRange {
  return {
    from: toArgDateInputValue(from),
    to: toArgDateInputValue(to),
    label: `${formatInTimeZone(from, AR_TIME_ZONE, "dd/MM/yyyy")} - ${formatInTimeZone(to, AR_TIME_ZONE, "dd/MM/yyyy")}`,
  }
}

function money(value: number) {
  return `U$D ${value.toLocaleString("de-DE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

function percentDelta(current: number, previous?: number | null) {
  if (previous == null) return undefined
  if (previous === 0) return current > 0 ? 100 : 0
  return ((current - previous) / previous) * 100
}

function buildCompareRange(from: Date, to: Date, compare: CompareMode) {
  if (compare === "none") return null

  if (compare === "yoy") {
    return { from: subYears(from, 1), to: subYears(to, 1) }
  }

  const days = differenceInCalendarDays(to, from) + 1
  const compareTo = subDays(from, 1)
  return { from: subDays(compareTo, days - 1), to: compareTo }
}

function dayKey(date: Date) {
  return formatInTimeZone(date, AR_TIME_ZONE, "yyyy-MM-dd")
}

function dayLabel(date: Date) {
  return formatInTimeZone(date, AR_TIME_ZONE, "dd/MM")
}

function longDayLabel(date: Date) {
  return formatInTimeZone(date, AR_TIME_ZONE, "dd/MM/yyyy")
}

function mapToTopProducts(products: Map<string, DashboardTrendProductSummary>) {
  return Array.from(products.values())
    .sort((a, b) => b.units - a.units || b.profit - a.profit)
    .slice(0, 6)
}

function buildDailySalesSeries(
  currentDays: Date[],
  currentSales: SaleForTrend[],
  compareSales: Pick<SaleForTrend, "date" | "total">[],
  saleItems: SaleItemForInsight[],
  compare: CompareMode,
): {
  trend: DashboardRevenueTrendPoint[]
  details: DashboardTrendPointDetail[]
} {
  const currentByDay = new Map<string, { revenue: number; profit: number; salesCount: number }>()
  for (const sale of currentSales) {
    const key = dayKey(sale.date)
    const existing = currentByDay.get(key) ?? { revenue: 0, profit: 0, salesCount: 0 }
    existing.revenue += Number(sale.total)
    existing.profit += Number(sale.profit)
    existing.salesCount += 1
    currentByDay.set(key, existing)
  }

  const compareKeys = Array.from(new Set(compareSales.map((sale) => dayKey(sale.date)))).sort()
  const compareIndexByKey = new Map(compareKeys.map((key, index) => [key, index]))
  const compareByIndex = compareSales.reduce<number[]>((acc, sale, index) => {
    const key = dayKey(sale.date)
    const dayIndex = compareIndexByKey.get(key) ?? index
    acc[dayIndex] = (acc[dayIndex] ?? 0) + Number(sale.total)
    return acc
  }, [])

  const productsByDay = new Map<string, Map<string, DashboardTrendProductSummary>>()
  for (const item of saleItems) {
    const key = dayKey(item.sale.date)
    const productKey = item.product.id
    const dayProducts = productsByDay.get(key) ?? new Map<string, DashboardTrendProductSummary>()
    const existing =
      dayProducts.get(productKey) ??
      ({
        id: item.product.id,
        name: getProductDisplayModel(item.product),
        type: item.product.type,
        units: 0,
        revenue: 0,
        profit: 0,
      } satisfies DashboardTrendProductSummary)

    existing.units += item.units
    existing.revenue += Number(item.lineTotal)
    existing.profit += Number(item.lineProfit)
    dayProducts.set(productKey, existing)
    productsByDay.set(key, dayProducts)
  }

  const trend: DashboardRevenueTrendPoint[] = []
  const details: DashboardTrendPointDetail[] = []

  currentDays.forEach((date, index) => {
    const key = dayKey(date)
    const current = currentByDay.get(key) ?? { revenue: 0, profit: 0, salesCount: 0 }
    const comparisonRevenue = compare === "none" ? undefined : compareByIndex[index] ?? 0

    trend.push(
      compare === "none"
        ? {
            date: dayLabel(date),
            dateKey: key,
            Ingresos: current.revenue,
            Utilidad: current.profit,
          }
        : {
            date: dayLabel(date),
            dateKey: key,
            Actual: current.revenue,
            Comparacion: comparisonRevenue,
          },
    )

    details.push({
      dateKey: key,
      label: longDayLabel(date),
      revenue: current.revenue,
      profit: current.profit,
      salesCount: current.salesCount,
      comparisonRevenue,
      products: mapToTopProducts(productsByDay.get(key) ?? new Map<string, DashboardTrendProductSummary>()),
    })
  })

  return { trend, details }
}

function buildTopProductInsights(saleItems: SaleItemForInsight[]): DashboardProductInsightItem[] {
  const topProductsMap = new Map<string, DashboardProductInsightItem>()

  for (const item of saleItems) {
    const existing =
      topProductsMap.get(item.product.id) ??
      ({
        id: item.product.id,
        name: getProductDisplayModel(item.product),
        type: item.product.type,
        unitsSold: 0,
        revenue: 0,
        profit: 0,
      } satisfies DashboardProductInsightItem)

    existing.unitsSold += item.units
    existing.revenue += Number(item.lineTotal)
    existing.profit += Number(item.lineProfit)
    topProductsMap.set(item.product.id, existing)
  }

  return Array.from(topProductsMap.values()).sort((a, b) => b.unitsSold - a.unitsSold || b.profit - a.profit)
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const session = await requireRolePage(["ADMIN", "SOCIO"])
  const params = (await searchParams) ?? {}
  const today = fromArgDateInputValue(toArgDateInputValue(new Date()))
  const defaultTo = today
  const defaultFrom = subDays(today, 29)

  const parsedFrom = parseDateParam(params.from) ?? defaultFrom
  const parsedTo = parseDateParam(params.to) ?? defaultTo
  const rangeFrom = parsedFrom <= parsedTo ? parsedFrom : parsedTo
  const rangeTo = parsedFrom <= parsedTo ? parsedTo : parsedFrom
  const compare = parseCompare(params.compare)
  const compareRangeDates = buildCompareRange(rangeFrom, rangeTo, compare)
  const rangeEndExclusive = addDays(rangeTo, 1)
  const compareEndExclusive = compareRangeDates ? addDays(compareRangeDates.to, 1) : null
  const currentDays = eachDayOfInterval({ start: rangeFrom, end: rangeTo })

  const [
    currentSales,
    compareSales,
    productsForValuation,
    stockByStateAndType,
    productsInRepair,
    productsInTransit,
    appointments,
    saleItems,
    inventoryProductsBase,
    negativeMarginSales,
    totalSuppliers,
    totalPurchases,
    totalSales,
    totalCostProfiles,
    totalWholesaleOrders,
  ] = await Promise.all([
    prisma.sale.findMany({
      where: { date: { gte: rangeFrom, lt: rangeEndExclusive } },
      select: { id: true, date: true, total: true, profit: true, costTotal: true },
    }),
    compareRangeDates
      ? prisma.sale.findMany({
          where: { date: { gte: compareRangeDates.from, lt: compareEndExclusive! } },
          select: { id: true, date: true, total: true, profit: true },
        })
      : Promise.resolve([]),
    prisma.product.findMany({
      where: { state: "EN_STOCK" },
      select: { id: true, costPrice: true, stock: true, stockAvailable: true },
    }),
    prisma.product.groupBy({
      by: ["state", "type"],
      _sum: { stock: true },
    }),
    prisma.product.count({ where: { state: "EN_REPARACION" } }),
    prisma.product.count({ where: { state: "EN_CAMINO" } }),
    prisma.appointment.findMany({
      where: { scheduledAt: { gte: rangeFrom, lt: rangeEndExclusive } },
      select: { id: true, status: true, outcome: true, saleId: true },
    }),
    prisma.saleItem.findMany({
      where: { sale: { date: { gte: rangeFrom, lt: rangeEndExclusive } } },
      select: {
        units: true,
        lineTotal: true,
        lineProfit: true,
        sale: { select: { date: true } },
        product: { select: { id: true, modelName: true, type: true, ...productCatalogDisplaySelect } },
      },
    }),
    prisma.product.findMany({
      where: { status: "AVAILABLE" },
      orderBy: [{ stockAvailable: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        modelName: true,
        type: true,
        ...productCatalogDisplaySelect,
        stockAvailable: true,
        stock: true,
        stockInitial: true,
        state: true,
        status: true,
        createdAt: true,
      },
    }),
    prisma.sale.findMany({
      where: { date: { gte: rangeFrom, lt: rangeEndExclusive }, profit: { lt: 0 } },
      select: { id: true, profit: true },
      take: 8,
    }),
    prisma.supplier.count(),
    prisma.purchase.count(),
    prisma.sale.count(),
    prisma.costProfile.count(),
    prisma.wholesaleOrder.count(),
  ])

  const salesTotal = currentSales.reduce((acc, sale) => acc + Number(sale.total), 0)
  const profitTotal = currentSales.reduce((acc, sale) => acc + Number(sale.profit), 0)
  const compareSalesTotal = compareSales.reduce((acc, sale) => acc + Number(sale.total), 0)
  const compareProfitTotal = compareSales.reduce((acc, sale) => acc + Number(sale.profit), 0)
  const inventoryValuation = productsForValuation.reduce(
    (acc, product) => acc + Number(product.costPrice) * product.stock,
    0,
  )
  const stockAvailableTotal = productsForValuation.reduce((acc, product) => acc + product.stockAvailable, 0)
  const averageTicket = currentSales.length ? salesTotal / currentSales.length : 0
  const compareAverageTicket = compareSales.length ? compareSalesTotal / compareSales.length : 0
  const dailyRevenue = buildDailySalesSeries(currentDays, currentSales, compareSales, saleItems, compare)
  const topProducts = buildTopProductInsights(saleItems)
  const inventoryProducts: DashboardInventoryInsightItem[] = inventoryProductsBase.map((product) => ({
    id: product.id,
    name: getProductDisplayModel(product),
    type: product.type,
    stockAvailable: product.stockAvailable,
    stockTotal: product.stock,
    stockInitial: product.stockInitial,
    state: product.state,
    status: product.status,
    daysInInventory: differenceInCalendarDays(today, product.createdAt),
  }))
  const criticalStockCount = inventoryProducts.filter(
    (product) => product.state === "EN_STOCK" && product.stockAvailable <= DEFAULT_CRITICAL_STOCK_THRESHOLD,
  ).length
  const agingProductsCount = inventoryProducts.filter(
    (product) => product.stockAvailable > 0 && product.daysInInventory >= DEFAULT_AGING_DAYS_THRESHOLD,
  ).length
  const stockComposition: DashboardStockCompositionItem[] = stockByStateAndType.map((row) => ({
    name: row.state,
    type: row.type,
    value: row._sum.stock ?? 0,
  }))

  const data: DashboardOverviewData = {
    role: session.user.activeRole as "ADMIN" | "SOCIO",
    range: asRange(rangeFrom, rangeTo),
    compare,
    compareRange: compareRangeDates ? asRange(compareRangeDates.from, compareRangeDates.to) : null,
    defaults: {
      productTypeFilter: "ALL",
      criticalStockThreshold: DEFAULT_CRITICAL_STOCK_THRESHOLD,
      agingDaysThreshold: DEFAULT_AGING_DAYS_THRESHOLD,
      topProductsMetric: "units",
    },
    kpis: [
      {
        key: "sales-total",
        title: "Ventas Totales",
        value: money(salesTotal),
        subtitle: `${currentSales.length} ventas en el periodo`,
        trend: percentDelta(salesTotal, compare === "none" ? undefined : compareSalesTotal),
        tone: "info",
      },
      {
        key: "gross-profit",
        title: "Utilidad Bruta",
        value: money(profitTotal),
        subtitle: "Resultado bruto del periodo",
        trend: percentDelta(profitTotal, compare === "none" ? undefined : compareProfitTotal),
        tone: "success",
      },
      {
        key: "inventory-valuation",
        title: "Valuacion de Inventario",
        value: money(inventoryValuation),
        subtitle: "Capital inmovilizado en stock",
        tone: "warning",
        sensitive: true,
      },
      {
        key: "available-stock",
        title: "Stock Disponible",
        value: `${stockAvailableTotal} u.`,
        subtitle: "Unidades en estado EN_STOCK",
        tone: "default",
      },
      {
        key: "appointments",
        title: "Citas del Periodo",
        value: appointments.length,
        subtitle: "Turnos registrados en el rango",
        tone: "info",
      },
      {
        key: "repair",
        title: "Equipos en Reparacion",
        value: productsInRepair,
        subtitle: "Estado operativo actual",
        tone: productsInRepair > 0 ? "warning" : "default",
      },
      {
        key: "transit",
        title: "Logistica en Transito",
        value: productsInTransit,
        subtitle: "Equipos marcados EN_CAMINO",
        tone: "info",
      },
      {
        key: "average-ticket",
        title: "Ticket Promedio",
        value: money(averageTicket),
        subtitle: "Promedio por venta cerrada",
        trend: percentDelta(averageTicket, compare === "none" ? undefined : compareAverageTicket),
        tone: "default",
      },
    ],
    alerts: [
      criticalStockCount
        ? {
            id: "AL-01",
            severity: "Alta",
            description: `Stock critico en ${criticalStockCount} producto(s) con umbral ${DEFAULT_CRITICAL_STOCK_THRESHOLD}.`,
          }
        : null,
      agingProductsCount
        ? {
            id: "AL-02",
            severity: "Media",
            description: `${agingProductsCount} producto(s) con aging mayor o igual a ${DEFAULT_AGING_DAYS_THRESHOLD} dias.`,
          }
        : null,
      negativeMarginSales.length
        ? {
            id: "AL-03",
            severity: "Alta",
            description: `${negativeMarginSales.length} venta(s) del periodo con margen negativo.`,
          }
        : null,
      productsInRepair
        ? {
            id: "AL-04",
            severity: "Media",
            description: `${productsInRepair} equipo(s) actualmente en reparacion.`,
          }
        : null,
    ].filter(Boolean) as DashboardOverviewData["alerts"],
    revenueTrend: dailyRevenue.trend,
    revenueCategories: compare === "none" ? ["Ingresos", "Utilidad"] : ["Actual", "Comparacion"],
    revenueTrendDetails: dailyRevenue.details,
    stockComposition,
    appointmentsFunnel: [
      { name: "Citas", value: appointments.length },
      { name: "Concretadas", value: appointments.filter((a) => a.status === "CONCRETADA").length },
      { name: "Ventas", value: appointments.filter((a) => a.outcome === "VENTA_CONCRETADA" || a.saleId).length },
      { name: "No venta", value: appointments.filter((a) => a.outcome === "NO_SE_CONCRETO").length },
    ],
    topProducts,
    inventoryProducts,
    systemStats: [
      { name: "Proveedores", value: totalSuppliers },
      { name: "Compras", value: totalPurchases },
      { name: "Ventas", value: totalSales },
      { name: "Cost profiles", value: totalCostProfiles },
      { name: "Pedidos mayoristas", value: totalWholesaleOrders },
    ],
  }

  return (
    <DashboardLayout>
      <DashboardOverviewClient data={data} />
    </DashboardLayout>
  )
}
