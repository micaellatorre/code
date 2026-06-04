import Link from "next/link"
import type { Metadata } from "next"
import DashboardLayout from "@/components/DashboardLayout"
import Breadcrumbs from "@/components/Breadcrumbs"
import TradeInQuoteFlow from "@/components/trade-in/TradeInQuoteFlow"
import { requireRolePage } from "@/lib/auth/auth"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Plan Canje",
}

export default async function TradeInPage() {
  const session = await requireRolePage(["ADMIN", "VENDEDOR"])
  const isAdmin = session.user.activeRole === "ADMIN"

  return (
    <DashboardLayout>
      <Breadcrumbs items={[{ label: "Inicio", href: "/" }, { label: "Plan Canje" }]} />
      <div className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Plan Canje</h1>
            <p className="text-sm text-base-content/70">Cotizacion de equipos entregados como credito contra stock actual.</p>
          </div>
          {isAdmin ? <Link href="/dashboard/trade-in/config" className="btn btn-outline btn-sm">Configuracion</Link> : null}
        </div>
        <TradeInQuoteFlow role={session.user.activeRole} />
      </div>
    </DashboardLayout>
  )
}
