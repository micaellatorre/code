import { requireRolePage } from "@/lib/auth/auth"
import ProductFormDialog from "@/components/products/ProductFormDialog"

export default async function NewProductModalPage() {
  await requireRolePage(["ADMIN", "VENDEDOR", "STOCK"])
  return <ProductFormDialog mode="create" />
}
