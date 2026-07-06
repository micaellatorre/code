import Breadcrumbs from "@/components/Breadcrumbs"
import DashboardLayout from "@/components/DashboardLayout"
import UserBranchAdmin from "@/components/users/UserBranchAdmin"
import { requireRolePage } from "@/lib/auth/auth"
import { resolveSessionTenantId } from "@/lib/tenant"
import prisma from "@/lib/prisma"

export const dynamic = "force-dynamic"

export default async function UsersPage() {
  const session = await requireRolePage(["ADMIN"])
  const tenantId = await resolveSessionTenantId(session.user.tenantId)
  if (!tenantId) throw new Error("Tenant no disponible")

  const [users, branches] = await Promise.all([
    prisma.user.findMany({
      where: { tenantId },
      orderBy: [{ isActive: "desc" }, { name: "asc" }, { email: "asc" }],
      include: {
        currentBranch: { select: { id: true, code: true, name: true } },
        branchCoverages: { select: { branchId: true } },
      },
    }),
    prisma.branch.findMany({
      where: { tenantId, isActive: true },
      orderBy: [{ name: "asc" }, { code: "asc" }],
      select: { id: true, code: true, name: true },
    }),
  ])

  return (
    <DashboardLayout>
      <Breadcrumbs items={[{ label: "Inicio", href: "/" }, { label: "Mi Equipo" }]} />
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold">Mi Equipo</h1>
          <p className="text-sm text-base-content/60">Gestion de sucursal actual y cobertura operativa.</p>
        </div>
        <UserBranchAdmin
          branches={branches}
          users={users.map((user) => ({
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            isActive: user.isActive,
            currentBranchId: user.currentBranchId,
            currentBranch: user.currentBranch,
            coverageBranchIds: user.branchCoverages.map((coverage) => coverage.branchId),
          }))}
        />
      </div>
    </DashboardLayout>
  )
}
