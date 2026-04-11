import { requireRolePage } from '@/lib/auth/auth'
import EditBuyerForm from './form'

interface EditBuyerPageProps {
  params: { id: string }
}

export default async function EditBuyerPage({ params }: EditBuyerPageProps) {
  await requireRolePage(['ADMIN', 'VENDEDOR'])
  return <EditBuyerForm id={params.id} />
}