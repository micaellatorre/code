import { requireRolePageWithFallback } from '@/lib/auth/auth'
import EditProductForm from './form'

interface EditProductPageProps {
  params: { id: string }
}

export default async function EditProductPage({ params }: EditProductPageProps) {
  await requireRolePageWithFallback(['ADMIN', 'STOCK'], '/dashboard/products/[id]/edit')
  return <EditProductForm id={params.id} />
}
