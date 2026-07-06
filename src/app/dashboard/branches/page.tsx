import Breadcrumbs from "@/components/Breadcrumbs"
import DashboardLayout from "@/components/DashboardLayout"
import BranchesTable from "@/components/branches/BranchesTable"
import { requireRolePage } from "@/lib/auth/auth"
import { resolveSessionTenantId } from "@/lib/tenant"
import { listBranches } from "@/lib/domain/branches"

export const dynamic = "force-dynamic"

export default async function BranchesPage() {
  const session = await requireRolePage(["ADMIN", "SOCIO", "VENDEDOR", "STOCK"])
  const tenantId = await resolveSessionTenantId(session.user.tenantId)
  if (!tenantId) throw new Error("Tenant no disponible")

  const branches = await listBranches(tenantId)

  return (
    <DashboardLayout>
      <Breadcrumbs items={[{ label: "Inicio", href: "/" }, { label: "Sucursales" }]} />
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold">Sucursales</h1>
          <p className="text-sm text-base-content/60">Administracion de ubicaciones fisicas y stock por sede.</p>
        </div>
        <BranchesTable branches={branches} canManage={session.user.activeRole === "ADMIN"} />
      </div>
    </DashboardLayout>
  )
}
