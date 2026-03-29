import { requireRolePageWithFallback } from '@/lib/auth/auth'
import NewBuyerForm from './form'

export default async function NewBuyerPage() {
  await requireRolePageWithFallback(['ADMIN', 'VENDEDOR'], '/dashboard/buyers/new')
  return <NewBuyerForm />
}
