import { requireRolePage } from '@/lib/auth/auth'
import NewWholesaleOrderForm from './form'

export default async function NewWholesaleOrderPage() {
  await requireRolePage(['ADMIN', 'VENDEDOR'])
  return <NewWholesaleOrderForm />
}
