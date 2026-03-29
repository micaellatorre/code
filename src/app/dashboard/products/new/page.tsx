import { requireRolePageWithFallback } from '@/lib/auth/auth'
import NewProductForm from './form'

export const dynamic = 'force-dynamic'

export default async function NewProductPage() {
  await requireRolePageWithFallback(['ADMIN', 'STOCK'], '/dashboard/products/new')
  return <NewProductForm />
}
