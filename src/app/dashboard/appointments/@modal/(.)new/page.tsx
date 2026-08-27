import { requireRolePage } from "@/lib/auth/auth"
import AppointmentFormDialog from "@/components/appointments/AppointmentFormDialog"

export default async function NewAppointmentModalPage() {
  await requireRolePage(["ADMIN", "VENDEDOR"])
  return <AppointmentFormDialog mode="create" />
}
