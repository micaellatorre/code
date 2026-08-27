import WholesaleOrderFormDialog from "@/components/wholesale-orders/WholesaleOrderFormDialog"
import { requireRolePage } from "@/lib/auth/auth"

export default async function NewWholesaleOrderModalPage() {
  await requireRolePage(["ADMIN", "VENDEDOR"])
  return <WholesaleOrderFormDialog />
}
