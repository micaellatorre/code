import { requireRolePageWithFallback } from '@/lib/auth/auth'
import EditSaleForm from './form'

interface EditSalePageProps {
  params: { id: string }
}

export default async function EditSalePage({ params }: EditSalePageProps) {
  await requireRolePageWithFallback(['ADMIN'], '/dashboard/sales/[id]/edit')
  return <EditSaleForm id={params.id} />
}
