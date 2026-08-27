import { requireRolePage } from "@/lib/auth/auth"
import CostProfileFormDialog from "@/components/cost-profiles/CostProfileFormDialog"

export default async function NewCostProfileModalPage() {
  await requireRolePage(["ADMIN"])
  return <CostProfileFormDialog />
}
