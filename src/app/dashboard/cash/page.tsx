import type { Metadata } from "next"
import Breadcrumbs from "@/components/Breadcrumbs"
import DashboardLayout from "@/components/DashboardLayout"
import CashDashboard from "@/components/cash/CashDashboard"
import { requireRolePage } from "@/lib/auth/auth"
import { getCashDashboardData } from "@/lib/domain/cash"
import { resolveSessionTenantId } from "@/lib/tenant"

export const metadata: Metadata = {
  title: "Caja",
  description: "Saldos, flujo diario y movimientos por cuenta.",
}

export const dynamic = "force-dynamic"

export default async function CashPage() {
  const session = await requireRolePage(["ADMIN", "SOCIO"])
  const tenantId = await resolveSessionTenantId(session.user.tenantId)
  if (!tenantId) throw new Error("Tenant no disponible")

  const data = await getCashDashboardData({
    tenantId,
    actorUserId: session.user.id,
    actorRole: session.user.activeRole,
  })

  return (
    <DashboardLayout>
      <Breadcrumbs items={[{ label: "Inicio", href: "/" }, { label: "Caja" }]} />
      <CashDashboard data={data} isAdmin={session.user.activeRole === "ADMIN"} />
    </DashboardLayout>
  )
}
