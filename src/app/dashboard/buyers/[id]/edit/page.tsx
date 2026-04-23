import { requireRolePage } from '@/lib/auth/auth'
import EditBuyerForm from './form'

interface EditBuyerPageProps {
  params: Promise<{ id: string }>
}

export default async function EditBuyerPage({ params }: EditBuyerPageProps) {
  const { id } = await params
  await requireRolePage(['ADMIN', 'VENDEDOR'])
  return <EditBuyerForm id={id} />
}