import Breadcrumbs from "@/components/Breadcrumbs"
import DashboardLayout from "@/components/DashboardLayout"
import ReservationEditForm from "@/components/reservations/ReservationEditForm"
import prisma from "@/lib/prisma"
import { requireRolePage } from "@/lib/auth/auth"
import { resolveSessionTenantId } from "@/lib/tenant"

type Props = { params: Promise<{ id: string }> }

function inputDate(value: Date | null) {
  if (!value) return ""
  return value.toISOString().slice(0, 16)
}

export default async function EditReservationPage({ params }: Props) {
  const session = await requireRolePage(["ADMIN", "VENDEDOR"])
  const tenantId = await resolveSessionTenantId(session.user.tenantId)
  if (!tenantId) throw new Error("Tenant no disponible")
  const { id } = await params
  const reservation = await prisma.reservation.findFirst({ where: { id, tenantId } })
  if (!reservation) throw new Error("Reserva no encontrada")

  return (
    <DashboardLayout>
      <Breadcrumbs items={[{ label: "Inicio", href: "/" }, { label: "Reserva", href: `/dashboard/reservations/${id}` }, { label: "Editar" }]} />
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Editar reserva</h1>
        <ReservationEditForm initial={{ id, pickupAt: inputDate(reservation.pickupAt), agreedTotal: reservation.agreedTotal?.toString() ?? "", notes: reservation.notes ?? "" }} />
      </div>
    </DashboardLayout>
  )
}
