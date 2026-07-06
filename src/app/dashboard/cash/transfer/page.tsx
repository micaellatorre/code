import Breadcrumbs from "@/components/Breadcrumbs"
import DashboardLayout from "@/components/DashboardLayout"
import CashTransferForm from "@/components/cash/CashTransferForm"
import { requireRolePage } from "@/lib/auth/auth"

export default async function CashTransferPage() {
  await requireRolePage(["ADMIN"])
  return (
    <DashboardLayout>
      <Breadcrumbs items={[{ label: "Inicio", href: "/" }, { label: "Caja", href: "/dashboard/database?tab=cash" }, { label: "Convertir moneda" }]} />
      <div className="space-y-4"><h1 className="text-2xl font-bold">Convertir moneda</h1><CashTransferForm /></div>
    </DashboardLayout>
  )
}
