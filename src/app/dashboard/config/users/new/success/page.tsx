import Link from "next/link"
import { notFound } from "next/navigation"
import { CheckCircleIcon } from "@heroicons/react/24/solid"
import Breadcrumbs from "@/components/Breadcrumbs"
import DashboardLayout from "@/components/DashboardLayout"
import { requireRolePage } from "@/lib/auth/auth"
import { resolveSessionTenantId } from "@/lib/tenant"
import { getUserDetail } from "@/lib/domain/users"

type SuccessPageProps = {
  searchParams: Promise<{ userId?: string }>
}

export const dynamic = "force-dynamic"

export default async function NewUserSuccessPage({ searchParams }: SuccessPageProps) {
  const session = await requireRolePage(["ADMIN"])
  const tenantId = await resolveSessionTenantId(session.user.tenantId)
  if (!tenantId) throw new Error("Tenant no disponible")

  const { userId } = await searchParams
  if (!userId) notFound()

  const user = await getUserDetail({ tenantId, userId })
  if (!user) notFound()

  const coverageLabel = user.role === "ADMIN"
    ? "Todas las sucursales del tenant"
    : user.branchCoverages.map((coverage) => coverage.branch.name).join(" / ") || "Sin cobertura"

  return (
    <DashboardLayout>
      <Breadcrumbs
        items={[
          { label: "Inicio", href: "/" },
          { label: "Configuracion", href: "/dashboard/config?tab=equipo" },
          { label: "Usuario creado" },
        ]}
      />
      <div className="mx-auto max-w-3xl space-y-5">
        <div className="rounded-lg border border-success/30 bg-success/10 p-5">
          <div className="flex items-start gap-3">
            <CheckCircleIcon className="mt-0.5 size-7 text-success" />
            <div>
              <h1 className="text-2xl font-bold">Usuario creado correctamente</h1>
              <p className="text-sm text-base-content/70">El email ya queda habilitado para iniciar sesion con Google si el usuario esta activo.</p>
            </div>
          </div>
        </div>

        <section className="rounded-lg border border-base-300 bg-base-100 p-4">
          <h2 className="text-lg font-semibold">Resumen</h2>
          <dl className="mt-4 grid gap-3 sm:grid-cols-2">
            <div>
              <dt className="text-xs uppercase text-base-content/50">Nombre</dt>
              <dd className="font-medium">{user.name ?? "-"}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase text-base-content/50">Email</dt>
              <dd className="font-medium">{user.email}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase text-base-content/50">Rol</dt>
              <dd><span className="badge badge-outline">{user.role}</span></dd>
            </div>
            <div>
              <dt className="text-xs uppercase text-base-content/50">Estado</dt>
              <dd>{user.isActive ? <span className="badge badge-success">Activo</span> : <span className="badge badge-ghost">Inactivo</span>}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase text-base-content/50">Tenant</dt>
              <dd className="font-medium">{user.tenant?.name ?? user.tenantId ?? "-"}</dd>
              <dd className="text-xs text-base-content/50">{user.tenantId}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase text-base-content/50">Sucursal actual</dt>
              <dd className="font-medium">{user.currentBranch?.name ?? "-"}</dd>
              <dd className="text-xs text-base-content/50">{user.currentBranch?.code ?? ""}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-xs uppercase text-base-content/50">Cobertura</dt>
              <dd className="font-medium">{coverageLabel}</dd>
            </div>
          </dl>
        </section>

        <div className="flex justify-end gap-2">
          <Link href="/dashboard/config?tab=equipo" className="btn btn-ghost">Volver a Mi equipo</Link>
          <Link href={`/dashboard/config/users/${user.id}/edit`} className="btn btn-primary">Editar usuario</Link>
        </div>
      </div>
    </DashboardLayout>
  )
}
