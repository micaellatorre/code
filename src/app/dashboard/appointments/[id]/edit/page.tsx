import { requireRolePageWithFallback } from '@/lib/auth/auth'
import EditAppointmentForm from './form'

interface EditAppointmentPageProps {
  params: { id: string }
}

export default async function EditAppointmentPage({ params }: EditAppointmentPageProps) {
  await requireRolePageWithFallback(['ADMIN', 'VENDEDOR'], '/dashboard/appointments/[id]/edit')
  return <EditAppointmentForm id={params.id} />
}
