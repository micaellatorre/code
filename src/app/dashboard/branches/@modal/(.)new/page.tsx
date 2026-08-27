import { requireRolePage } from "@/lib/auth/auth"
import BranchFormDialog from "@/components/branches/BranchFormDialog"

export default async function NewBranchModalPage() {
  await requireRolePage(["ADMIN"])
  return <BranchFormDialog mode="create" />
}
