import Breadcrumbs from "@/components/Breadcrumbs"
import DashboardLayout from "@/components/DashboardLayout"
import CommissionPlansManager from "@/components/commissions/CommissionPlansManager"
import { requireRolePage } from "@/lib/auth/auth"
import { resolveSessionTenantId } from "@/lib/tenant"
import { listCommissionPlans, listCommissionSellers } from "@/lib/domain/commissions"

export const dynamic = "force-dynamic"

export default async function CommissionsPage() {
  const session = await requireRolePage(["ADMIN", "SOCIO"])
  const tenantId = await resolveSessionTenantId(session.user.tenantId)
  if (!tenantId) throw new Error("Tenant no disponible")
  const [plans, sellers] = await Promise.all([
    listCommissionPlans(tenantId),
    listCommissionSellers(tenantId),
  ])

  return (
    <DashboardLayout>
      <Breadcrumbs items={[{ label: "Inicio", href: "/" }, { label: "Comisiones" }]} />
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold">Comisiones</h1>
          <p className="text-sm text-base-content/60">Gestion de planes y comisiones de vendedores.</p>
        </div>
        <CommissionPlansManager plans={plans} sellers={sellers} />
      </div>
    </DashboardLayout>
  )
}
