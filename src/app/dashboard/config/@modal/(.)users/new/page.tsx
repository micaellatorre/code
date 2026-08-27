import { requireRolePage } from "@/lib/auth/auth"
import { resolveSessionTenantId } from "@/lib/tenant"
import { getUserFormOptions, userRoleValues } from "@/lib/domain/users"
import UserFormDialog from "@/components/users/UserFormDialog"

export const dynamic = "force-dynamic"

export default async function NewUserModalPage() {
  const session = await requireRolePage(["ADMIN"])
  const tenantId = await resolveSessionTenantId(session.user.tenantId)
  if (!tenantId) throw new Error("Tenant no disponible")

  const options = await getUserFormOptions({
    actorUserId: session.user.id,
    actorRole: session.user.activeRole,
    tenantId,
  })

  return (
    <UserFormDialog
      mode="create"
      roles={[...userRoleValues]}
      tenantOptions={options.tenantOptions}
      branches={options.branches}
      defaultTenantId={tenantId}
      defaultBranchId={session.user.currentBranchId ?? options.branches[0]?.id ?? null}
    />
  )
}
