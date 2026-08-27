import { requireRolePage } from "@/lib/auth/auth"
import ReservationFormDialog from "@/components/reservations/ReservationFormDialog"

export default async function NewReservationDatabaseModalPage() {
  await requireRolePage(["ADMIN", "VENDEDOR"])
  return <ReservationFormDialog mode="create" />
}
