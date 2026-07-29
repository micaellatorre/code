import Breadcrumbs from "@/components/Breadcrumbs"
import DashboardLayout from "@/components/DashboardLayout"
import ConfigDashboard from "@/components/config/ConfigDashboard"
import { requireRolePage } from "@/lib/auth/auth"
import { resolveSessionTenantId } from "@/lib/tenant"
import { getUsersDashboardData } from "@/lib/domain/users-dashboard"

export const dynamic = "force-dynamic"

export default async function ConfigPage() {
  const session = await requireRolePage(["ADMIN"])
  const tenantId = await resolveSessionTenantId(session.user.tenantId)
  if (!tenantId) throw new Error("Tenant no disponible")
  const team = await getUsersDashboardData(tenantId)

  return (
    <DashboardLayout>
      <Breadcrumbs items={[{ label: "Inicio", href: "/" }, { label: "Configuracion" }]} />
      <ConfigDashboard team={team} />
    </DashboardLayout>
  )
}
