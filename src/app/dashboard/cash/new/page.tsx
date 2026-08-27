import { Suspense } from "react"
import Breadcrumbs from "@/components/Breadcrumbs"
import DashboardLayout from "@/components/DashboardLayout"
import CashMovementForm from "@/components/cash/CashMovementForm"
import { requireRolePage } from "@/lib/auth/auth"

export default async function NewCashMovementPage() {
  await requireRolePage(["ADMIN"])
  return (
    <DashboardLayout>
      <Breadcrumbs items={[{ label: "Inicio", href: "/" }, { label: "Caja", href: "/dashboard/cash" }, { label: "Nuevo movimiento" }]} />
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Nuevo movimiento de caja</h1>
        <Suspense fallback={<div className="p-6">Cargando formulario...</div>}>
          <CashMovementForm />
        </Suspense>
      </div>
    </DashboardLayout>
  )
}
