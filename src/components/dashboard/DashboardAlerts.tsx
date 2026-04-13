import { Badge, Card } from "@tremor/react"
import type { DashboardAlert } from "./DashboardTypes"

type DashboardAlertsProps = {
  alerts: DashboardAlert[]
}

const severityColor: Record<DashboardAlert["severity"], "red" | "amber" | "slate"> = {
  Alta: "red",
  Media: "amber",
  Baja: "slate",
}

export default function DashboardAlerts({ alerts }: DashboardAlertsProps) {
  const hasAlerts = alerts.length > 0

  return (
    <Card
      className={`rounded-lg border shadow-sm ${
        hasAlerts ? "border-warning/30 bg-warning/10" : "border-emerald-500/20 bg-emerald-500/10"
      }`}
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-base-content">Alertas ejecutivas</h2>
          <p className="mt-1 text-sm text-base-content/70">
            {hasAlerts ? "Riesgos operativos que requieren seguimiento." : "Sin alertas activas para los umbrales actuales."}
          </p>
        </div>
        <Badge color={hasAlerts ? "amber" : "emerald"}>{alerts.length}</Badge>
      </div>

      {hasAlerts ? (
        <div className="grid gap-3 md:grid-cols-2">
          {alerts.map((alert) => (
            <div key={alert.id} className="rounded-lg border border-warning/30 bg-base-100 px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-semibold text-base-content">{alert.id}</span>
                <Badge color={severityColor[alert.severity]}>{alert.severity}</Badge>
              </div>
              <p className="mt-2 text-sm text-base-content/70">{alert.description}</p>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-emerald-500/20 bg-base-100 px-4 py-3 text-sm text-base-content/70">
          Stock, aging y margen no disparan alertas con la configuracion inicial del dashboard.
        </div>
      )}
    </Card>
  )
}
