import { requireRolePage } from '@/lib/auth/auth'
import EditSaleForm from './form'

interface EditSalePageProps {
  params: Promise<{ id: string }>
}

export default async function EditSalePage({ params }: EditSalePageProps) {
  const { id } = await params
  await requireRolePage(['ADMIN'])
  return <EditSaleForm id={id} />
}
