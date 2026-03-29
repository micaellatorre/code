import { requireRolePageWithFallback } from '@/lib/auth/auth'
import NewSaleForm from './form'

export default async function NewSalePage() {
  await requireRolePageWithFallback(['ADMIN', 'VENDEDOR'], '/dashboard/sales/new')
  return <NewSaleForm />
}
