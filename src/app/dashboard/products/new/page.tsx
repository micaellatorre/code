import { requireRolePage } from '@/lib/auth/auth'
import NewProductForm from './form'

export const dynamic = 'force-dynamic'

export default async function NewProductPage() {
  await requireRolePage(['ADMIN', 'STOCK'])
  return <NewProductForm />
}
