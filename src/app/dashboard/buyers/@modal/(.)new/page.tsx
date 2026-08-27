import { requireRolePage } from "@/lib/auth/auth"
import BuyerFormDialog from "@/components/buyers/BuyerFormDialog"

export default async function NewBuyerModalPage() {
  await requireRolePage(["ADMIN", "VENDEDOR"])
  return <BuyerFormDialog mode="create" />
}
