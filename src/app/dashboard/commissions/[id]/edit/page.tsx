import { notFound } from "next/navigation"
import Breadcrumbs from "@/components/Breadcrumbs"
import DashboardLayout from "@/components/DashboardLayout"
import SellerCommissionEditor from "@/components/commissions/SellerCommissionEditor"
import { requireRolePage } from "@/lib/auth/auth"
import { resolveSessionTenantId } from "@/lib/tenant"
import { getSellerCommissionWorkspace } from "@/lib/domain/commissions"

type EditSellerCommissionsPageProps = {
  params: Promise<{ id: string }>
}

export const dynamic = "force-dynamic"

export default async function EditSellerCommissionsPage({ params }: EditSellerCommissionsPageProps) {
  const session = await requireRolePage(["ADMIN"])
  const tenantId = await resolveSessionTenantId(session.user.tenantId)
  if (!tenantId) throw new Error("Tenant no disponible")

  const { id } = await params
  const workspace = await getSellerCommissionWorkspace({ tenantId, sellerId: id })
  if (!workspace) notFound()

  return (
    <DashboardLayout>
      <Breadcrumbs
        items={[
          { label: "Inicio", href: "/" },
          { label: "Comisiones", href: "/dashboard/commissions" },
          { label: workspace.seller.name ?? workspace.seller.email },
        ]}
      />
      <div className="space-y-5">
        <div>
          <h1 className="text-2xl font-bold">Comisiones de vendedor</h1>
          <p className="text-sm text-base-content/60">Los closers son usuarios con rol VENDEDOR. Desde aca podes generar y seguir comisiones por venta.</p>
        </div>
        <SellerCommissionEditor
          seller={workspace.seller}
          plans={workspace.plans}
          sales={workspace.sales}
          commissions={workspace.commissions}
        />
      </div>
    </DashboardLayout>
  )
}
