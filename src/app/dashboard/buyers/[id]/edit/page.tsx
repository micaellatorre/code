import { requireRolePageWithFallback } from '@/lib/auth/auth'
import EditBuyerForm from './form'

interface EditBuyerPageProps {
  params: { id: string }
}

export default async function EditBuyerPage({ params }: EditBuyerPageProps) {
  await requireRolePageWithFallback(['ADMIN', 'VENDEDOR'], '/dashboard/buyers/[id]/edit')
  return <EditBuyerForm id={params.id} />
}