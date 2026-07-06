import Breadcrumbs from "@/components/Breadcrumbs"
import DashboardLayout from "@/components/DashboardLayout"
import BranchForm from "@/components/branches/BranchForm"
import { requireRolePage } from "@/lib/auth/auth"

export default async function NewBranchPage() {
  await requireRolePage(["ADMIN"])

  return (
    <DashboardLayout>
      <Breadcrumbs items={[{ label: "Inicio", href: "/" }, { label: "Sucursales", href: "/dashboard/branches" }, { label: "Nueva sucursal" }]} />
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Nueva sucursal</h1>
        <BranchForm />
      </div>
    </DashboardLayout>
  )
}
