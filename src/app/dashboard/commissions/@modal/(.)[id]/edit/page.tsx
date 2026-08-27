import { notFound } from "next/navigation"
import { requireRolePage } from "@/lib/auth/auth"
import { resolveSessionTenantId } from "@/lib/tenant"
import { getSellerCommissionWorkspace } from "@/lib/domain/commissions"
import SellerCommissionDialog from "@/components/commissions/SellerCommissionDialog"

type EditSellerCommissionsModalPageProps = {
  params: Promise<{ id: string }>
}

export const dynamic = "force-dynamic"

export default async function EditSellerCommissionsModalPage({ params }: EditSellerCommissionsModalPageProps) {
  const session = await requireRolePage(["ADMIN"])
  const tenantId = await resolveSessionTenantId(session.user.tenantId)
  if (!tenantId) throw new Error("Tenant no disponible")

  const { id } = await params
  const workspace = await getSellerCommissionWorkspace({ tenantId, sellerId: id })
  if (!workspace) notFound()

  return (
    <SellerCommissionDialog
      seller={workspace.seller}
      plans={workspace.plans}
      sales={workspace.sales}
      commissions={workspace.commissions}
    />
  )
}
