import ServiceOrderFormDialog from "@/components/service-orders/ServiceOrderFormDialog"
import { requireRolePage } from "@/lib/auth/auth"

export default async function NewServiceOrderFromDatabaseModalPage() {
  await requireRolePage(["ADMIN", "VENDEDOR", "STOCK"])
  return <ServiceOrderFormDialog />
}
