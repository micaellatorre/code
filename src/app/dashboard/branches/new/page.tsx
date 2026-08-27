import Breadcrumbs from "@/components/Breadcrumbs"
import DashboardLayout from "@/components/DashboardLayout"
import { requireRolePage } from "@/lib/auth/auth"
import NewBranchForm from "./form"

export default async function NewBranchPage() {
  await requireRolePage(["ADMIN"])

  return (
    <DashboardLayout>
      <Breadcrumbs items={[{ label: "Inicio", href: "/" }, { label: "Sucursales", href: "/dashboard/branches" }, { label: "Nueva sucursal" }]} />
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Nueva sucursal</h1>
        <NewBranchForm />
      </div>
    </DashboardLayout>
  )
}
