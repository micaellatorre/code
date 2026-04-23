"use client"

import { useEffect, useMemo, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import {
  AreaChart,
  Badge,
  BarChart,
  Button,
  DateRangePicker,
  DateRangePickerItem,
  DonutChart,
  FunnelChart,
  Select,
  SelectItem,
  type CustomTooltipProps,
  type DateRangePickerValue,
  type EventProps,
} from "@tremor/react"
import { es } from "date-fns/locale"
import DashboardKpiCard from "@/components/DashboardKpiCard"
import DashboardAlerts from "./DashboardAlerts"
import DashboardLegendList from "./DashboardLegendList"
import DashboardMetricModeSelect from "./DashboardMetricModeSelect"
import DashboardProductTypeToggle from "./DashboardProductTypeToggle"
import DashboardSection from "./DashboardSection"
import DashboardSystemStats from "./DashboardSystemStats"
import DashboardThresholdControl from "./DashboardThresholdControl"
import DashboardTrendDetail from "./DashboardTrendDetail"
import DashboardWidgetToggleDialog, { type DashboardWidgetDefinition } from "./DashboardWidgetToggleDialog"
import type {
  CompareMode,
  DashboardInventoryInsightItem,
  DashboardOverviewData,
  DashboardProductMetricMode,
  DashboardProductTypeFilter,
  DashboardStockCompositionItem,
  DashboardWidgetKey,
} from "./DashboardTypes"

const widgetDefinitions: DashboardWidgetDefinition[] = [
  { key: "kpis", label: "KPIs", description: "Indicadores principales del periodo." },
  { key: "alerts", label: "Alertas", description: "Riesgos de stock, aging, margen y reparacion." },
  { key: "revenueTrend", label: "Tendencia de ingresos", description: "Ingresos, utilidad y detalle por dia." },
  { key: "stockComposition", label: "Composicion de stock", description: "Distribucion por estado y tipo." },
  { key: "appointmentsFunnel", label: "Embudo de citas", description: "Citas, concretadas, ventas y no venta." },
  { key: "topProducts", label: "Top productos vendidos", description: "Ranking por unidades o utilidad." },
  { key: "criticalStock", label: "Stock critico", description: "Productos bajo umbral configurable." },
  { key: "inventoryAging", label: "Aging de inventario", description: "Productos con dias altos en inventario." },
  { key: "systemStats", label: "Metricas del sistema", description: "Conteos operativos generales." },
]

const defaultVisibleWidgets = widgetDefinitions.reduce(
  (acc, widget) => ({ ...acc, [widget.key]: true }),
  {} as Record<DashboardWidgetKey, boolean>,
)

const moneyFormatter = (value: number) =>
  `U$D ${value.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const numberFormatter = (value: number) => value.toLocaleString("es-AR")

type DashboardOverviewClientProps = {
  data: DashboardOverviewData
}

type DashboardLocalFilters = {
  topProductsType: DashboardProductTypeFilter
  criticalStockType: DashboardProductTypeFilter
  inventoryAgingType: DashboardProductTypeFilter
  stockCompositionType: DashboardProductTypeFilter
  criticalStockThreshold: number
  agingDaysThreshold: number
  topProductsMetric: DashboardProductMetricMode
}

type DashboardPreferences = {
  visibleWidgets?: Partial<Record<DashboardWidgetKey, boolean>>
  filters?: Partial<DashboardLocalFilters>
}

function toDateRangeValue(data: DashboardOverviewData): DateRangePickerValue {
  return {
    from: new Date(`${data.range.from}T00:00:00`),
    to: new Date(`${data.range.to}T00:00:00`),
  }
}

function toDateParam(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")

  return `${year}-${month}-${day}`
}

function formatCompare(compare: CompareMode) {
  if (compare === "previous") return "Periodo anterior"
  if (compare === "yoy") return "Mismo periodo ano anterior"
  return "Sin comparacion"
}

function productTypeLabel(value: DashboardProductTypeFilter) {
  if (value === "PHONE") return "iPhones"
  if (value === "ACCESSORY") return "Accesorios"
  return "Todos"
}

function matchesType<T extends { type: "PHONE" | "ACCESSORY" }>(item: T, filter: DashboardProductTypeFilter) {
  return filter === "ALL" || item.type === filter
}

function aggregateStockComposition(items: DashboardStockCompositionItem[], filter: DashboardProductTypeFilter) {
  const byState = new Map<string, number>()

  for (const item of items) {
    if (!matchesType(item, filter)) continue
    byState.set(item.name, (byState.get(item.name) ?? 0) + item.value)
  }

  return Array.from(byState.entries())
    .map(([name, value]) => ({ name, value }))
    .filter((item) => item.value > 0)
    .sort((a, b) => b.value - a.value)
}

function defaultFilters(data: DashboardOverviewData): DashboardLocalFilters {
  return {
    topProductsType: data.defaults.productTypeFilter,
    criticalStockType: data.defaults.productTypeFilter,
    inventoryAgingType: data.defaults.productTypeFilter,
    stockCompositionType: data.defaults.productTypeFilter,
    criticalStockThreshold: data.defaults.criticalStockThreshold,
    agingDaysThreshold: data.defaults.agingDaysThreshold,
    topProductsMetric: data.defaults.topProductsMetric,
  }
}

function RevenueTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload?.length) return null

  return (
    <div className="rounded-lg border border-base-content/10 bg-base-100 px-3 py-2 text-sm border border-base-content/50">
      <p className="mb-2 font-semibold text-base-content">{String(label ?? "")}</p>
      <div className="space-y-1">
        {payload.map((item) => (
          <div key={String(item.name)} className="flex items-center justify-between gap-4">
            <span className="text-base-content/60">{String(item.name)}</span>
            <span className="font-medium text-base-content">{moneyFormatter(Number(item.value ?? 0))}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function UnitsTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload?.length) return null

  return (
    <div className="rounded-lg border border-base-content/10 bg-base-100 px-3 py-2 text-sm border border-base-content/50">
      <p className="mb-2 font-semibold text-base-content">{String(label ?? "")}</p>
      <div className="space-y-1">
        {payload.map((item) => (
          <div key={String(item.name)} className="flex items-center justify-between gap-4">
            <span className="text-base-content/60">{String(item.name ?? "Unidades")}</span>
            <span className="font-medium text-base-content">{numberFormatter(Number(item.value ?? 0))} u.</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function EmptyState({ children }: { children: string }) {
  return (
    <div className="rounded-lg border border-dashed border-base-content/20 bg-base-200/50 p-6 text-center text-sm text-base-content/60">
      {children}
    </div>
  )
}

function InventoryRows({ items, mode }: { items: DashboardInventoryInsightItem[]; mode: "stock" | "aging" }) {
  if (!items.length) return <EmptyState>No hay productos para mostrar con estos filtros.</EmptyState>

  return (
    <div className="mt-4 space-y-3">
      {items.slice(0, 8).map((item) => (
        <div key={item.id} className="rounded-lg border border-base-content/10 bg-base-200/40 px-4 py-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-base-content">{item.name}</p>
              <p className="mt-1 text-xs text-base-content/60">
                {item.type === "PHONE" ? "iPhone" : "Accesorio"} - {item.state}
              </p>
            </div>
            <Badge color={mode === "stock" ? "red" : "amber"}>
              {mode === "stock" ? `${item.stockAvailable} disp.` : `${item.daysInInventory} dias`}
            </Badge>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2 text-xs text-base-content/70">
            <span>Total: {item.stockTotal}</span>
            <span>Inicial: {item.stockInitial}</span>
            <span>Disponible: {item.stockAvailable}</span>
          </div>
        </div>
      ))}
    </div>
  )
}

export default function DashboardOverviewClient({ data }: DashboardOverviewClientProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [editOpen, setEditOpen] = useState(false)
  const [visibleWidgets, setVisibleWidgets] = useState(defaultVisibleWidgets)
  const [filters, setFilters] = useState<DashboardLocalFilters>(() => defaultFilters(data))
  const [selectedTrendKey, setSelectedTrendKey] = useState<string | null>(null)
  const preferencesKey = `tech-stock:dashboard:preferences:${data.role}`
  const legacyWidgetStorageKey = `tech-stock:dashboard:widgets:${data.role}`

  useEffect(() => {
    const storedPreferences = window.localStorage.getItem(preferencesKey)
    const storedLegacyWidgets = window.localStorage.getItem(legacyWidgetStorageKey)

    if (!storedPreferences && !storedLegacyWidgets) {
      setVisibleWidgets(defaultVisibleWidgets)
      setFilters(defaultFilters(data))
      return
    }

    try {
      const parsedPreferences = storedPreferences ? (JSON.parse(storedPreferences) as DashboardPreferences) : {}
      const parsedLegacyWidgets = storedLegacyWidgets
        ? (JSON.parse(storedLegacyWidgets) as Partial<Record<DashboardWidgetKey, boolean>>)
        : {}

      setVisibleWidgets({
        ...defaultVisibleWidgets,
        ...parsedLegacyWidgets,
        ...parsedPreferences.visibleWidgets,
      })
      setFilters({
        ...defaultFilters(data),
        ...parsedPreferences.filters,
      })
    } catch {
      setVisibleWidgets(defaultVisibleWidgets)
      setFilters(defaultFilters(data))
    }
  }, [data, legacyWidgetStorageKey, preferencesKey])

  useEffect(() => {
    setSelectedTrendKey(null)
  }, [data.revenueTrendDetails])

  function persistPreferences(next: DashboardPreferences) {
    window.localStorage.setItem(
      preferencesKey,
      JSON.stringify({
        visibleWidgets,
        filters,
        ...next,
      }),
    )
  }

  function updateUrl(next: { from?: string; to?: string; compare?: CompareMode }) {
    const params = new URLSearchParams(searchParams.toString())
    if (next.from) params.set("from", next.from)
    if (next.to) params.set("to", next.to)
    if (next.compare) params.set("compare", next.compare)
    router.replace(`${pathname}?${params.toString()}`)
  }

  function toggleWidget(key: DashboardWidgetKey, value: boolean) {
    const next = { ...visibleWidgets, [key]: value }
    setVisibleWidgets(next)
    persistPreferences({ visibleWidgets: next })
  }

  function updateFilters(nextFilters: Partial<DashboardLocalFilters>) {
    const next = { ...filters, ...nextFilters }
    setFilters(next)
    persistPreferences({ filters: next })
  }

  function handleRangeChange(value: DateRangePickerValue) {
    if (!value.from || !value.to) return
    updateUrl({
      from: toDateParam(value.from),
      to: toDateParam(value.to),
    })
  }

  function handleTrendValueChange(value: EventProps) {
    const dateKey = typeof value?.dateKey === "string" ? value.dateKey : null
    setSelectedTrendKey(dateKey)
  }

  const rangePresets = useMemo(() => {
    const today = new Date()
    const currentMonthStart = new Date(today.getFullYear(), today.getMonth(), 1)
    const currentYearStart = new Date(today.getFullYear(), 0, 1)

    return [
      {
        key: "last-7-days",
        label: "Ultimos 7 dias",
        from: new Date(today.getFullYear(), today.getMonth(), today.getDate() - 6),
        to: today,
      },
      {
        key: "last-30-days",
        label: "Ultimos 30 dias",
        from: new Date(today.getFullYear(), today.getMonth(), today.getDate() - 29),
        to: today,
      },
      {
        key: "current-month",
        label: "Mes actual",
        from: currentMonthStart,
        to: today,
      },
      {
        key: "ytd",
        label: "Ano transcurrido",
        from: currentYearStart,
        to: today,
      },
    ]
  }, [])

  const visibleKpis = useMemo(
    () => data.kpis.filter((kpi) => data.role === "ADMIN" || !kpi.sensitive),
    [data.kpis, data.role],
  )

  const selectedTrendDetail = useMemo(() => {
    const explicitSelection = selectedTrendKey
      ? data.revenueTrendDetails.find((detail) => detail.dateKey === selectedTrendKey)
      : null

    if (explicitSelection) return explicitSelection

    return (
      [...data.revenueTrendDetails]
        .reverse()
        .find((detail) => detail.revenue > 0 || detail.profit > 0 || detail.salesCount > 0) ??
      data.revenueTrendDetails.at(-1) ??
      null
    )
  }, [data.revenueTrendDetails, selectedTrendKey])

  const topProducts = useMemo(() => {
    return data.topProducts
      .filter((product) => matchesType(product, filters.topProductsType))
      .sort((a, b) =>
        filters.topProductsMetric === "units"
          ? b.unitsSold - a.unitsSold || b.profit - a.profit
          : b.profit - a.profit || b.unitsSold - a.unitsSold,
      )
      .slice(0, 10)
  }, [data.topProducts, filters.topProductsMetric, filters.topProductsType])

  const topProductsChart = useMemo(
    () =>
      topProducts.map((product) => ({
        name: product.name,
        Unidades: product.unitsSold,
        Utilidad: product.profit,
      })),
    [topProducts],
  )

  const criticalStockProducts = useMemo(() => {
    return data.inventoryProducts
      .filter((product) => product.state === "EN_STOCK")
      .filter((product) => matchesType(product, filters.criticalStockType))
      .filter((product) => product.stockAvailable <= filters.criticalStockThreshold)
      .sort((a, b) => a.stockAvailable - b.stockAvailable || a.name.localeCompare(b.name))
      .slice(0, 12)
  }, [data.inventoryProducts, filters.criticalStockThreshold, filters.criticalStockType])

  const criticalStockChart = useMemo(
    () => criticalStockProducts.slice(0, 8).map((product) => ({ name: product.name, Disponible: product.stockAvailable })),
    [criticalStockProducts],
  )

  const agingProducts = useMemo(() => {
    return data.inventoryProducts
      .filter((product) => product.stockAvailable > 0)
      .filter((product) => matchesType(product, filters.inventoryAgingType))
      .filter((product) => product.daysInInventory >= filters.agingDaysThreshold)
      .sort((a, b) => b.daysInInventory - a.daysInInventory || b.stockAvailable - a.stockAvailable)
      .slice(0, 12)
  }, [data.inventoryProducts, filters.agingDaysThreshold, filters.inventoryAgingType])

  const agingChart = useMemo(
    () => agingProducts.slice(0, 8).map((product) => ({ name: product.name, Dias: product.daysInInventory })),
    [agingProducts],
  )

  const stockComposition = useMemo(
    () => aggregateStockComposition(data.stockComposition, filters.stockCompositionType),
    [data.stockComposition, filters.stockCompositionType],
  )
  const stockCompositionTotal = stockComposition.reduce((acc, item) => acc + item.value, 0)
  const stockCompositionLegend = stockComposition.map((item) => ({
    name: item.name,
    value: item.value,
    percentage: stockCompositionTotal ? (item.value / stockCompositionTotal) * 100 : 0,
  }))

  return (
    <div className="min-h-screen bg-base-200 px-4 py-6 text-base-content sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-semibold text-base-content">Overview</h1>
              <Badge color={data.role === "ADMIN" ? "blue" : "slate"}>{data.role}</Badge>
            </div>
            <p className="mt-2 max-w-2xl text-sm text-base-content/60">
              Panel ejecutivo de ventas, inventario, citas y operacion.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Badge color="slate">{data.range.label}</Badge>
              <Badge color={data.compare === "none" ? "slate" : "blue"}>{formatCompare(data.compare)}</Badge>
              {data.compareRange ? <Badge color="slate">Base: {data.compareRange.label}</Badge> : null}
            </div>
          </div>

          <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center min-w-fit">
            <DateRangePicker
              className="sm:w-72"
              value={toDateRangeValue(data)}
              onValueChange={handleRangeChange}
              enableClear={false}
              displayFormat="dd/MM/yyyy"
              enableYearNavigation
              weekStartsOn={1}
              locale={es}
              selectPlaceholder="Seleccionar"
              color="blue"
            >
              {rangePresets.map((preset) => (
                <DateRangePickerItem key={preset.key} value={preset.key} from={preset.from} to={preset.to}>
                  {preset.label}
                </DateRangePickerItem>
              ))}
            </DateRangePicker>
            <Select
              className="sm:w-64 ml-10"
              value={data.compare}
              onValueChange={(value) => updateUrl({ compare: value as CompareMode })}
            >
              <SelectItem value="none">Sin comparacion</SelectItem>
              <SelectItem value="previous">Periodo anterior</SelectItem>
              <SelectItem value="yoy">Mismo periodo ano anterior</SelectItem>
            </Select>
            <Button variant="secondary" onClick={() => setEditOpen(true)}>
              Editar widgets
            </Button>
          </div>
        </div>

        {visibleWidgets.alerts ? <DashboardAlerts alerts={data.alerts} /> : null}

        {visibleWidgets.kpis ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {visibleKpis.map((kpi) => (
              <DashboardKpiCard
                key={kpi.key}
                title={kpi.title}
                value={kpi.value}
                subtitle={kpi.subtitle}
                trend={kpi.trend}
                tone={kpi.tone}
              />
            ))}
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          {visibleWidgets.revenueTrend ? (
            <DashboardSection
              title="Tendencia de ingresos"
              subtitle={
                data.compare === "none"
                  ? "Ingresos y utilidad con inspeccion diaria."
                  : "Periodo actual comparado contra la base seleccionada."
              }
              className="xl:col-span-2"
              action={<Badge color="blue">{selectedTrendDetail?.label ?? "Sin seleccion"}</Badge>}
            >
              <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">
                <AreaChart
                  className="h-80"
                  data={data.revenueTrend}
                  index="date"
                  categories={data.revenueCategories}
                  colors={data.compare === "none" ? ["blue", "emerald"] : ["blue", "slate"]}
                  valueFormatter={moneyFormatter}
                  yAxisWidth={72}
                  showLegend
                  customTooltip={RevenueTooltip}
                  onValueChange={handleTrendValueChange}
                />
                <DashboardTrendDetail
                  detail={selectedTrendDetail}
                  compareEnabled={data.compare !== "none"}
                  moneyFormatter={moneyFormatter}
                />
              </div>
            </DashboardSection>
          ) : null}

          {visibleWidgets.stockComposition ? (
            <DashboardSection
              title="Composicion del stock"
              subtitle={`Distribucion por estado - ${productTypeLabel(filters.stockCompositionType)}.`}
              action={
                <DashboardProductTypeToggle
                  compact
                  value={filters.stockCompositionType}
                  onChange={(stockCompositionType) => updateFilters({ stockCompositionType })}
                />
              }
            >
              <div className="grid grid-cols-1 gap-5">
                <DonutChart
                  className="h-64"
                  data={stockComposition}
                  category="value"
                  index="name"
                  valueFormatter={numberFormatter}
                  colors={["emerald", "blue", "amber", "red", "slate"]}
                  customTooltip={UnitsTooltip}
                />
                <DashboardLegendList items={stockCompositionLegend} valueFormatter={(value) => `${numberFormatter(value)} u.`} />
              </div>
            </DashboardSection>
          ) : null}
        </div>


        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                    {visibleWidgets.systemStats ? <DashboardSystemStats data={data.systemStats} /> : null}
                    {visibleWidgets.topProducts ? (
            <DashboardSection
              title="Top productos vendidos"
              subtitle={`Ranking por ${filters.topProductsMetric === "units" ? "unidades" : "utilidad"} - ${productTypeLabel(filters.topProductsType)}.`}
              action={
                <div className="flex flex-wrap justify-end gap-2">
                  <DashboardProductTypeToggle
                    compact
                    value={filters.topProductsType}
                    onChange={(topProductsType) => updateFilters({ topProductsType })}
                  />
                  <DashboardMetricModeSelect
                    value={filters.topProductsMetric}
                    onChange={(topProductsMetric) => updateFilters({ topProductsMetric })}
                  />
                </div>
              }
            >
              {topProductsChart.length ? (
                <>
                  <BarChart
                    className="h-72"
                    data={topProductsChart}
                    index="name"
                    categories={[filters.topProductsMetric === "units" ? "Unidades" : "Utilidad"]}
                    colors={[filters.topProductsMetric === "units" ? "blue" : "emerald"]}
                    valueFormatter={filters.topProductsMetric === "units" ? numberFormatter : moneyFormatter}
                    layout="vertical"
                    yAxisWidth={120}
                    showLegend={false}
                  />
                  {/* <div className="mt-4 space-y-2">
                    {topProducts.map((product) => (
                      <div key={product.id} className="flex items-center justify-between gap-3 text-sm">
                        <div className="min-w-0">
                          <p className="truncate font-medium text-base-content">{product.name}</p>
                          <p className="text-xs text-base-content/60">
                            {product.unitsSold} u. - {product.type === "PHONE" ? "iPhone" : "Accesorio"}
                          </p>
                        </div>
                        <span className="font-semibold text-base-content">{moneyFormatter(product.profit)}</span>
                      </div>
                    ))}
                  </div> */}
                </>
              ) : (
                <EmptyState>No hay ventas para el filtro seleccionado.</EmptyState>
              )}
            </DashboardSection>
          ) : null}
          {/* {visibleWidgets.appointmentsFunnel ? (
            <DashboardSection title="Embudo de citas" subtitle="Citas, conversion comercial y no venta.">
              <FunnelChart
                className="h-80"
                data={data.appointmentsFunnel}
                valueFormatter={numberFormatter}
                color="blue"
                showArrow
                showGridLines
              />
            </DashboardSection>
          ) : null} */}



          {visibleWidgets.criticalStock ? (
            <DashboardSection
              title="Stock critico"
              subtitle={`Productos EN_STOCK con disponible menor o igual a ${filters.criticalStockThreshold}.`}
              action={
                <div className="flex flex-wrap justify-end gap-2">
                  <DashboardProductTypeToggle
                    compact
                    value={filters.criticalStockType}
                    onChange={(criticalStockType) => updateFilters({ criticalStockType })}
                  />
                  <DashboardThresholdControl
                    label="Umbral"
                    value={filters.criticalStockThreshold}
                    min={0}
                    max={50}
                    onChange={(criticalStockThreshold) => updateFilters({ criticalStockThreshold })}
                  />
                </div>
              }
            >
              {criticalStockChart.length ? (
                <>
                  {/* <BarChart
                    className="h-72"
                    data={criticalStockChart}
                    index="name"
                    categories={["Disponible"]}
                    colors={["red"]}
                    valueFormatter={numberFormatter}
                    layout="vertical"
                    yAxisWidth={120}
                    showLegend={false}
                  /> */}
                  <InventoryRows items={criticalStockProducts} mode="stock" />
                </>
              ) : (
                <EmptyState>No hay productos bajo el umbral actual.</EmptyState>
              )}
            </DashboardSection>
          ) : null}

          {visibleWidgets.inventoryAging ? (
            <DashboardSection
              title="Aging de inventario"
              subtitle={`Productos con ${filters.agingDaysThreshold} dias o mas en inventario.`}
              action={
                <div className="flex flex-wrap justify-end gap-2">
                  <DashboardProductTypeToggle
                    compact
                    value={filters.inventoryAgingType}
                    onChange={(inventoryAgingType) => updateFilters({ inventoryAgingType })}
                  />
                  <DashboardThresholdControl
                    label="Dias"
                    value={filters.agingDaysThreshold}
                    min={1}
                    max={365}
                    onChange={(agingDaysThreshold) => updateFilters({ agingDaysThreshold })}
                  />
                </div>
              }
            >
              {agingChart.length ? (
                <>
                  <BarChart
                    className="h-72"
                    data={agingChart}
                    index="name"
                    categories={["Dias"]}
                    colors={["amber"]}
                    valueFormatter={(value: number) => `${numberFormatter(value)} dias`}
                    layout="vertical"
                    yAxisWidth={120}
                    showLegend={false}
                  />
                  <InventoryRows items={agingProducts} mode="aging" />
                </>
              ) : (
                <EmptyState>No hay productos que superen el umbral de aging.</EmptyState>
              )}
            </DashboardSection>
          ) : null}


        </div>
      </div>

      <DashboardWidgetToggleDialog
        open={editOpen}
        onClose={setEditOpen}
        widgets={widgetDefinitions}
        visibleWidgets={visibleWidgets}
        onToggle={toggleWidget}
      />
    </div>
  )
}
