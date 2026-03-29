import { requireRolePageWithFallback } from '@/lib/auth/auth'
import NewPurchaseForm from './form'

export default async function NewPurchasePage() {
  await requireRolePageWithFallback(['ADMIN', 'STOCK'], '/dashboard/purchases/new')
  return <NewPurchaseForm />
}
