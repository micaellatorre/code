import { requireRolePage } from '@/lib/auth/auth'
import NewSupplierForm from './form'

export default async function NewSupplierPage() {
  await requireRolePage(['ADMIN', 'STOCK'])
  return <NewSupplierForm />
}
