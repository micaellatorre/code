import { requireRolePage } from "@/lib/auth/auth"
import CommissionPlanFormDialog from "@/components/commissions/CommissionPlanFormDialog"

export default async function NewCommissionPlanModalPage() {
  await requireRolePage(["ADMIN"])
  return <CommissionPlanFormDialog />
}
