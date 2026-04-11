import { requireRolePage } from '@/lib/auth/auth'
import EditProductForm from './form'

interface EditProductPageProps {
  params: { id: string }
}

export default async function EditProductPage({ params }: EditProductPageProps) {
  await requireRolePage(['ADMIN', 'STOCK'])
  return <EditProductForm id={params.id} />
}
