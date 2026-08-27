import CashFormDialog from "@/components/cash/CashFormDialog"
import { requireRolePage } from "@/lib/auth/auth"

export default async function NewCashMovementModalPage() {
  await requireRolePage(["ADMIN"])
  return <CashFormDialog mode="movement" />
}
