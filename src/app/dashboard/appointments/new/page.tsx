import { requireRolePageWithFallback } from '@/lib/auth/auth'
import NewAppointmentForm from './form'

export default async function NewAppointmentPage() {
  await requireRolePageWithFallback(['ADMIN', 'VENDEDOR'], '/dashboard/appointments/new')
  return <NewAppointmentForm />
}
