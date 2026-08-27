import Breadcrumbs from "@/components/Breadcrumbs"
import DashboardLayout from "@/components/DashboardLayout"
import prisma from "@/lib/prisma"
import { requireRolePage } from "@/lib/auth/auth"
import { resolveSessionTenantId } from "@/lib/tenant"
import EditBranchForm from "./form"

type Props = { params: Promise<{ id: string }> }

export default async function EditBranchPage({ params }: Props) {
  const session = await requireRolePage(["ADMIN"])
  const tenantId = await resolveSessionTenantId(session.user.tenantId)
  if (!tenantId) throw new Error("Tenant no disponible")

  const { id } = await params
  const branch = await prisma.branch.findFirst({
    where: { id, tenantId },
    include: { provinceCoverages: { select: { provinceId: true } } },
  })
  if (!branch) throw new Error("Sucursal no encontrada")

  return (
    <DashboardLayout>
      <Breadcrumbs items={[{ label: "Inicio", href: "/" }, { label: "Sucursales", href: "/dashboard/branches" }, { label: "Editar sucursal" }]} />
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Editar sucursal</h1>
        <EditBranchForm
          initial={{
            id: branch.id,
            code: branch.code,
            name: branch.name,
            province: branch.province,
            provinceId: branch.provinceId,
            coverageProvinceIds: branch.provinceCoverages.map((coverage) => coverage.provinceId),
            city: branch.city,
            address: branch.address,
            phone: branch.phone,
            email: branch.email,
            isActive: branch.isActive,
          }}
        />
      </div>
    </DashboardLayout>
  )
}
