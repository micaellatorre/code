import Breadcrumbs from "@/components/Breadcrumbs"
import DashboardLayout from "@/components/DashboardLayout"
import ServiceOrderForm from "@/components/service-orders/ServiceOrderForm"
import { requireRolePage } from "@/lib/auth/auth"

export default async function NewServiceOrderPage() {
  await requireRolePage(["ADMIN", "VENDEDOR", "STOCK"])
  return (
    <DashboardLayout>
      <Breadcrumbs items={[{ label: "Inicio", href: "/" }, { label: "Servicio Tecnico", href: "/dashboard/database?tab=service" }, { label: "Nueva orden" }]} />
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Nueva orden de servicio</h1>
        <ServiceOrderForm />
      </div>
    </DashboardLayout>
  )
}
