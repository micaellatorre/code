import { requireRolePage } from '@/lib/auth/auth'
import EditAppointmentForm from './form'

interface EditAppointmentPageProps {
  params: Promise<{ id: string }>
}

export default async function EditAppointmentPage({ params }: EditAppointmentPageProps) {
  const { id } = await params
  await requireRolePage(['ADMIN', 'VENDEDOR'])
  return <EditAppointmentForm id={id} />
}
