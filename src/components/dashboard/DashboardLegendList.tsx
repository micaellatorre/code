type DashboardLegendListItem = {
  name: string
  value: number
  percentage: number
}

type DashboardLegendListProps = {
  items: DashboardLegendListItem[]
  valueFormatter?: (value: number) => string
}

export default function DashboardLegendList({ items, valueFormatter }: DashboardLegendListProps) {
  if (items.length === 0) {
    return <p className="text-sm text-base-content/60">No hay datos para el filtro seleccionado.</p>
  }

  return (
    <div className="space-y-2">
      {items.map((item) => (
        <div key={item.name} className="flex items-center justify-between gap-3 text-sm">
          <div className="min-w-0">
            <p className="truncate font-medium text-base-content">{item.name}</p>
            <p className="text-xs text-base-content/60">{item.percentage.toFixed(1)}%</p>
          </div>
          <span className="font-semibold text-base-content">
            {valueFormatter ? valueFormatter(item.value) : item.value.toLocaleString("es-AR")}
          </span>
        </div>
      ))}
    </div>
  )
}
