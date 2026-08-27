import CashFormDialog from "@/components/cash/CashFormDialog"
import { requireRolePage } from "@/lib/auth/auth"

export default async function CashTransferModalPage() {
  await requireRolePage(["ADMIN"])
  return <CashFormDialog mode="transfer" />
}
