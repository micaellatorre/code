import Breadcrumbs from "@/components/Breadcrumbs"
import DashboardLayout from "@/components/DashboardLayout"
import ReservationForm from "@/components/reservations/ReservationForm"
import { requireRolePage } from "@/lib/auth/auth"

export default async function NewReservationPage() {
  await requireRolePage(["ADMIN", "VENDEDOR"])
  return (
    <DashboardLayout>
      <Breadcrumbs items={[{ label: "Inicio", href: "/" }, { label: "Base de Datos", href: "/dashboard/database?tab=reservations" }, { label: "Nueva reserva" }]} />
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Nueva reserva</h1>
        <ReservationForm />
      </div>
    </DashboardLayout>
  )
}
