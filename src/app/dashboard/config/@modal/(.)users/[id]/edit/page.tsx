import { notFound } from "next/navigation"
import { requireRolePage } from "@/lib/auth/auth"
import { resolveSessionTenantId } from "@/lib/tenant"
import { getUserDetail, getUserFormOptions, userRoleValues } from "@/lib/domain/users"
import UserFormDialog from "@/components/users/UserFormDialog"

type EditUserModalPageProps = {
  params: Promise<{ id: string }>
}

export const dynamic = "force-dynamic"

export default async function EditUserModalPage({ params }: EditUserModalPageProps) {
  const session = await requireRolePage(["ADMIN"])
  const tenantId = await resolveSessionTenantId(session.user.tenantId)
  if (!tenantId) throw new Error("Tenant no disponible")

  const { id } = await params
  const [user, options] = await Promise.all([
    getUserDetail({ tenantId, userId: id }),
    getUserFormOptions({
      actorUserId: session.user.id,
      actorRole: session.user.activeRole,
      tenantId,
    }),
  ])

  if (!user) notFound()

  return (
    <UserFormDialog
      mode="edit"
      user={{
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        isActive: user.isActive,
        tenantId: user.tenantId,
        currentBranchId: user.currentBranchId,
      }}
      roles={[...userRoleValues]}
      tenantOptions={options.tenantOptions}
      branches={options.branches}
      defaultTenantId={tenantId}
      defaultBranchId={session.user.currentBranchId ?? options.branches[0]?.id ?? null}
    />
  )
}
