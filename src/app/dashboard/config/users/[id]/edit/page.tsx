import { notFound } from "next/navigation"
import Breadcrumbs from "@/components/Breadcrumbs"
import DashboardLayout from "@/components/DashboardLayout"
import UserForm from "@/components/users/UserForm"
import { requireRolePage } from "@/lib/auth/auth"
import { resolveSessionTenantId } from "@/lib/tenant"
import { getUserDetail, getUserFormOptions, userRoleValues } from "@/lib/domain/users"

type EditUserPageProps = {
  params: Promise<{ id: string }>
}

export const dynamic = "force-dynamic"

export default async function EditUserPage({ params }: EditUserPageProps) {
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
    <DashboardLayout>
      <Breadcrumbs
        items={[
          { label: "Inicio", href: "/" },
          { label: "Configuracion", href: "/dashboard/config?tab=equipo" },
          { label: user.name ?? user.email },
        ]}
      />
      <div className="mx-auto max-w-4xl space-y-5">
        <div>
          <h1 className="text-2xl font-bold">Editar usuario</h1>
          <p className="text-sm text-base-content/60">Actualiza datos de acceso, estado y contexto operativo.</p>
        </div>
        <UserForm
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
      </div>
    </DashboardLayout>
  )
}
