import Link from "next/link"
import { BuildingStorefrontIcon, CheckCircleIcon, MapPinIcon, Squares2X2Icon } from "@heroicons/react/24/outline"
import DashboardLayout from "@/components/DashboardLayout"
import Breadcrumbs from "@/components/Breadcrumbs"
import SuppliersTable from "@/components/suppliers/SuppliersTable"
import prisma from "@/lib/prisma"
import { requireRolePage } from "@/lib/auth/auth"
import { resolveSessionTenantId } from "@/lib/tenant"
import { listSuppliers } from "@/lib/domain/suppliers"
import { branchCreationOrder } from "@/lib/domain/branch-order"

type SuppliersPageProps = {
  searchParams?: Promise<{ q?: string; branchId?: string; page?: string }>
}

export default async function SuppliersPage({ searchParams }: SuppliersPageProps) {
  const session = await requireRolePage(["ADMIN", "STOCK"])
  const tenantId = await resolveSessionTenantId(session.user.tenantId)
  if (!tenantId) throw new Error("Tenant no disponible")

  const params = await searchParams
  const page = Number(params?.page ?? "1")
  const [{ suppliers, pagination }, branches] = await Promise.all([
    listSuppliers({
      tenantId,
      q: params?.q,
      branchId: params?.branchId,
      page: Number.isFinite(page) ? page : 1,
      pageSize: 50,
    }),
    prisma.branch.findMany({
      where: { tenantId, isActive: true },
      orderBy: branchCreationOrder,
      select: { id: true, code: true, name: true },
    }),
  ])
  const hasFilters = Boolean(params?.q || params?.branchId)
  const linkedSuppliers = suppliers.filter((supplier) => supplier.branch).length
  const coveredSuppliers = suppliers.filter((supplier) => supplier.branchCoverages.length > 0).length
  const legacySuppliers = suppliers.length - linkedSuppliers

  return (
    <DashboardLayout>
      <Breadcrumbs items={[{ label: "Inicio", href: "/" }, { label: "Proveedores", href: "/dashboard/suppliers" }]} />
      <div className="space-y-4">
        <div className="flex flex-col justify-between gap-3 md:flex-row md:items-end">
          <div>
            <h1 className="text-2xl font-bold">Proveedores</h1>
            <p className="text-sm text-base-content/60">Gestiona proveedores, sucursales y cobertura de abastecimiento.</p>
          </div>
          <Link href="/dashboard/suppliers/new" className="btn btn-primary">+ Nuevo proveedor</Link>
        </div>

        <div className="grid gap-3 md:grid-cols-4">
          <div className="rounded-lg border border-base-300 bg-base-100 p-3">
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-semibold uppercase text-base-content/50">Total</span>
              <BuildingStorefrontIcon className="size-5 text-primary" />
            </div>
            <p className="mt-1 text-2xl font-semibold">{pagination.total}</p>
          </div>
          <div className="rounded-lg border border-base-300 bg-base-100 p-3">
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-semibold uppercase text-base-content/50">Con sucursal</span>
              <CheckCircleIcon className="size-5 text-success" />
            </div>
            <p className="mt-1 text-2xl font-semibold">{linkedSuppliers}</p>
          </div>
          <div className="rounded-lg border border-base-300 bg-base-100 p-3">
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-semibold uppercase text-base-content/50">Con cobertura</span>
              <MapPinIcon className="size-5 text-info" />
            </div>
            <p className="mt-1 text-2xl font-semibold">{coveredSuppliers}</p>
          </div>
          <div className="rounded-lg border border-base-300 bg-base-100 p-3">
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-semibold uppercase text-base-content/50">Legacy</span>
              <Squares2X2Icon className="size-5 text-base-content/50" />
            </div>
            <p className="mt-1 text-2xl font-semibold">{legacySuppliers}</p>
          </div>
        </div>

        <form className="grid gap-3 rounded-lg border border-base-300 bg-base-100 p-3 md:grid-cols-[1fr_260px_auto_auto]">
          <input
            name="q"
            defaultValue={params?.q ?? ""}
            className="input input-bordered"
            placeholder="Buscar por proveedor, contacto, telefono, email..."
          />
          <select name="branchId" defaultValue={params?.branchId ?? ""} className="select select-bordered">
            <option value="">Todas las sucursales</option>
            {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
          </select>
          <button className="btn btn-outline" type="submit">Filtrar</button>
          {hasFilters ? <Link href="/dashboard/suppliers" className="btn btn-ghost">Limpiar</Link> : null}
        </form>

        <SuppliersTable suppliers={suppliers} />
        <div className="text-sm text-base-content/60">
          Mostrando {suppliers.length} de {pagination.total} proveedores.
        </div>
      </div>
    </DashboardLayout>
  )
}
