import type { Metadata } from "next"
import DashboardLayout from "@/components/DashboardLayout"
import Breadcrumbs from "@/components/Breadcrumbs"
import TradeInConfigPanel from "@/components/trade-in/TradeInConfigPanel"
import { requireRolePage } from "@/lib/auth/auth"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Configuracion Plan Canje",
}

export default async function TradeInConfigPage() {
  await requireRolePage(["ADMIN"])

  return (
    <DashboardLayout>
      <Breadcrumbs items={[{ label: "Inicio", href: "/" }, { label: "Plan Canje", href: "/dashboard/trade-in" }, { label: "Configuracion" }]} />
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Configuracion Plan Canje</h1>
          <p className="text-sm text-base-content/70">Valores de referencia, rangos de bateria y descuentos comerciales.</p>
        </div>
        <TradeInConfigPanel />
      </div>
    </DashboardLayout>
  )
}
