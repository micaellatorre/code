import { Badge } from "@tremor/react"
import type { DashboardTrendPointDetail } from "./DashboardTypes"

type DashboardTrendDetailProps = {
  detail: DashboardTrendPointDetail | null
  compareEnabled: boolean
  moneyFormatter: (value: number) => string
}

export default function DashboardTrendDetail({
  detail,
  compareEnabled,
  moneyFormatter,
}: DashboardTrendDetailProps) {
  if (!detail) {
    return (
      <div className="rounded-lg border border-base-content/10 bg-base-200/60 p-4 text-sm text-base-content/60">
        No hay ventas registradas para inspeccionar en este periodo.
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-base-content/10 bg-base-200/60 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase text-base-content/50">Detalle diario</p>
          <h3 className="mt-1 text-base font-semibold text-base-content">{detail.label}</h3>
        </div>
        <Badge color={detail.salesCount > 0 ? "blue" : "slate"}>{detail.salesCount} ventas</Badge>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <div>
          <p className="text-xs text-base-content/60">Ingresos</p>
          <p className="text-sm font-semibold text-base-content">{moneyFormatter(detail.revenue)}</p>
        </div>
        <div>
          <p className="text-xs text-base-content/60">Utilidad</p>
          <p className="text-sm font-semibold text-base-content">{moneyFormatter(detail.profit)}</p>
        </div>
        {compareEnabled ? (
          <div className="col-span-2">
            <p className="text-xs text-base-content/60">Comparacion</p>
            <p className="text-sm font-semibold text-base-content">
              {moneyFormatter(detail.comparisonRevenue ?? 0)}
            </p>
          </div>
        ) : null}
      </div>

      <div className="mt-4 border-t border-base-content/10 pt-4">
        <p className="text-xs font-medium uppercase text-base-content/50">Productos vendidos</p>
        {detail.products.length ? (
          <div className="mt-3 space-y-2">
            {detail.products.map((product) => (
              <div key={product.id} className="flex items-center justify-between gap-3 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-medium text-base-content">{product.name}</p>
                  <p className="text-xs text-base-content/60">
                    {product.units} u. - {product.type === "PHONE" ? "iPhone" : "Accesorio"}
                  </p>
                </div>
                <span className="font-semibold text-base-content">{moneyFormatter(product.profit)}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-sm text-base-content/60">Sin productos vendidos en este dia.</p>
        )}
      </div>
    </div>
  )
}
