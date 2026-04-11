import { requireRolePage } from '@/lib/auth/auth'
import EditSaleForm from './form'

interface EditSalePageProps {
  params: { id: string }
}

export default async function EditSalePage({ params }: EditSalePageProps) {
  await requireRolePage(['ADMIN'])
  return <EditSaleForm id={params.id} />
}
