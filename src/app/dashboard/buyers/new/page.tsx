import { requireRolePage } from '@/lib/auth/auth'
import NewBuyerForm from './form'

export default async function NewBuyerPage() {
  await requireRolePage(['ADMIN', 'VENDEDOR'])
  return <NewBuyerForm />
}
