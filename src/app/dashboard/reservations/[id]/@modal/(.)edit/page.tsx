import { requireRolePage } from "@/lib/auth/auth"
import { resolveSessionTenantId } from "@/lib/tenant"
import prisma from "@/lib/prisma"
import ReservationFormDialog from "@/components/reservations/ReservationFormDialog"

type EditReservationModalPageProps = {
  params: Promise<{ id: string }>
}

function inputDate(value: Date | null) {
  if (!value) return ""
  return value.toISOString().slice(0, 16)
}

export default async function EditReservationModalPage({ params }: EditReservationModalPageProps) {
  const session = await requireRolePage(["ADMIN", "VENDEDOR"])
  const tenantId = await resolveSessionTenantId(session.user.tenantId)
  if (!tenantId) throw new Error("Tenant no disponible")
  const { id } = await params
  const reservation = await prisma.reservation.findFirst({ where: { id, tenantId } })
  if (!reservation) throw new Error("Reserva no encontrada")

  return (
    <ReservationFormDialog
      mode="edit"
      initial={{
        id,
        pickupAt: inputDate(reservation.pickupAt),
        agreedTotal: reservation.agreedTotal?.toString() ?? "",
        notes: reservation.notes ?? "",
      }}
    />
  )
}
