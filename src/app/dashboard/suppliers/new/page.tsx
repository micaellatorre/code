import { requireRolePageWithFallback } from '@/lib/auth/auth'
import NewSupplierForm from './form'

export default async function NewSupplierPage() {
  await requireRolePageWithFallback(['ADMIN', 'STOCK'], '/dashboard/suppliers/new')
  return <NewSupplierForm />
}
