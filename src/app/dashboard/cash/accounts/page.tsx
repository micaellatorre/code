import Breadcrumbs from "@/components/Breadcrumbs"
import DashboardLayout from "@/components/DashboardLayout"
import CashAccountsManager from "@/components/cash/CashAccountsManager"
import prisma from "@/lib/prisma"
import { requireRolePage } from "@/lib/auth/auth"
import { resolveSessionTenantId } from "@/lib/tenant"

export default async function CashAccountsPage() {
  const session = await requireRolePage(["ADMIN", "SOCIO"])
  const tenantId = await resolveSessionTenantId(session.user.tenantId)
  if (!tenantId) throw new Error("Tenant no disponible")
  const accounts = await prisma.cashAccount.findMany({ where: { tenantId }, include: { branch: { select: { id: true, name: true, code: true } } }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] })
  return (
    <DashboardLayout>
      <Breadcrumbs items={[{ label: "Inicio", href: "/" }, { label: "Caja", href: "/dashboard/cash" }, { label: "Cuentas" }]} />
      <div className="space-y-4"><h1 className="text-2xl font-bold">Cuentas de caja</h1><CashAccountsManager accounts={accounts} isAdmin={session.user.activeRole === "ADMIN"} /></div>
    </DashboardLayout>
  )
}
