import { requireRolePage } from '@/lib/auth/auth'
import NewCostProfileForm from './form'

export default async function NewCostProfilePage() {
  await requireRolePage(['ADMIN'])
  return <NewCostProfileForm />
}
