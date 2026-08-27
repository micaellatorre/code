import { notFound } from "next/navigation"
import DashboardLayout from "@/components/DashboardLayout"
import Breadcrumbs from "@/components/Breadcrumbs"
import { requireRolePage } from "@/lib/auth/auth"
import { resolveSessionTenantId } from "@/lib/tenant"
import { getSupplierDetail } from "@/lib/domain/suppliers"
import EditSupplierForm from "./form"

type EditSupplierPageProps = {
  params: Promise<{ id: string }>
}

export default async function EditSupplierPage({ params }: EditSupplierPageProps) {
  const session = await requireRolePage(["ADMIN", "STOCK"])
  const tenantId = await resolveSessionTenantId(session.user.tenantId)
  if (!tenantId) throw new Error("Tenant no disponible")
  const { id } = await params
  const supplier = await getSupplierDetail({ tenantId, supplierId: id })
  if (!supplier) notFound()

  return (
    <DashboardLayout>
      <Breadcrumbs
        items={[
          { label: "Inicio", href: "/" },
          { label: "Proveedores", href: "/dashboard/suppliers" },
          { label: supplier.name },
        ]}
      />
      <div className="mx-auto max-w-4xl space-y-5">
        <div>
          <h1 className="text-2xl font-bold">Editar proveedor</h1>
          <p className="text-sm text-base-content/60">Actualiza datos, sucursal principal y cobertura de abastecimiento.</p>
        </div>
        <EditSupplierForm supplier={supplier} />
      </div>
    </DashboardLayout>
  )
}
