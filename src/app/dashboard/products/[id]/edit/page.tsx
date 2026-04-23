import { requireRolePage } from '@/lib/auth/auth'
import EditProductForm from './form'

interface EditProductPageProps {
  params: Promise<{ id: string }>
}

export default async function EditProductPage({ params }: EditProductPageProps) {
  const { id } = await params
  await requireRolePage(['ADMIN', 'STOCK'])
  return <EditProductForm id={id} />
}
