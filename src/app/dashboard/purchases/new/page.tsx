import { requireRolePage } from '@/lib/auth/auth'
import NewPurchaseForm from './form'

export default async function NewPurchasePage() {
  await requireRolePage(['ADMIN', 'STOCK'])
  return <NewPurchaseForm />
}
