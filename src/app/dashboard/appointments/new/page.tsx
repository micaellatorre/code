import { requireRolePage } from '@/lib/auth/auth'
import NewAppointmentForm from './form'

export default async function NewAppointmentPage() {
  await requireRolePage(['ADMIN', 'VENDEDOR'])
  return <NewAppointmentForm />
}
