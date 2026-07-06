import Breadcrumbs from "@/components/Breadcrumbs"
import DashboardLayout from "@/components/DashboardLayout"
import CommissionPlansManager from "@/components/commissions/CommissionPlansManager"
import prisma from "@/lib/prisma"
import { requireRolePage } from "@/lib/auth/auth"
import { resolveSessionTenantId } from "@/lib/tenant"

export default async function CommissionsPage() {
  const session = await requireRolePage(["ADMIN", "SOCIO"])
  const tenantId = await resolveSessionTenantId(session.user.tenantId)
  if (!tenantId) throw new Error("Tenant no disponible")
  const plans = (await prisma.closerCommissionPlan.findMany({ where: { tenantId }, orderBy: { createdAt: "desc" } })).map((plan) => ({
    id: plan.id,
    name: plan.name,
    base: plan.base,
    ratePct: plan.ratePct.toString(),
    isActive: plan.isActive,
  }))
  return (
    <DashboardLayout>
      <Breadcrumbs items={[{ label: "Inicio", href: "/" }, { label: "Closers", href: "/dashboard/database?tab=closers" }, { label: "Comisiones" }]} />
      <div className="space-y-4"><h1 className="text-2xl font-bold">Comisiones de closers</h1><CommissionPlansManager plans={plans} /></div>
    </DashboardLayout>
  )
}
