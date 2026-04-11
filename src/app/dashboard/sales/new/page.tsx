import { requireRolePage } from '@/lib/auth/auth'
import NewSaleForm from './form'

export default async function NewSalePage() {
  await requireRolePage(['ADMIN', 'VENDEDOR'])
  return <NewSaleForm />
}
