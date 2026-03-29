import { requireRolePageWithFallback } from '@/lib/auth/auth'
import NewWholesaleOrderForm from './form'

export default async function NewWholesaleOrderPage() {
  await requireRolePageWithFallback(['ADMIN', 'VENDEDOR'], '/dashboard/wholesale-orders/new')
  return <NewWholesaleOrderForm />
}
