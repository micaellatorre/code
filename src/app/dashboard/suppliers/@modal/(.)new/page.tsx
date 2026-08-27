import { requireRolePage } from "@/lib/auth/auth"
import SupplierFormDialog from "@/components/suppliers/SupplierFormDialog"

export default async function NewSupplierModalPage() {
  await requireRolePage(["ADMIN", "STOCK"])
  return <SupplierFormDialog mode="create" />
}
