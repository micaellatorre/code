import { requireRolePage } from "@/lib/auth/auth"
import AppointmentFormDialog from "@/components/appointments/AppointmentFormDialog"

type EditAppointmentModalPageProps = {
  params: Promise<{ id: string }>
}

export default async function EditAppointmentModalPage({ params }: EditAppointmentModalPageProps) {
  const { id } = await params
  await requireRolePage(["ADMIN", "VENDEDOR"])
  return <AppointmentFormDialog mode="edit" appointmentId={id} />
}
