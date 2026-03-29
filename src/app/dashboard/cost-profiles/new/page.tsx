import { requireRolePageWithFallback } from '@/lib/auth/auth'
import NewCostProfileForm from './form'

export default async function NewCostProfilePage() {
  await requireRolePageWithFallback(['ADMIN'], '/dashboard/cost-profiles/new')
  return <NewCostProfileForm />
}
