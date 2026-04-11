import { requireRolePage } from '@/lib/auth/auth'
import EditAppointmentForm from './form'

interface EditAppointmentPageProps {
  params: { id: string }
}

export default async function EditAppointmentPage({ params }: EditAppointmentPageProps) {
  await requireRolePage(['ADMIN', 'VENDEDOR'])
  return <EditAppointmentForm id={params.id} />
}
