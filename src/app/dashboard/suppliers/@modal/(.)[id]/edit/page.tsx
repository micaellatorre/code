import { requireRolePage } from "@/lib/auth/auth"
import SupplierFormDialog from "@/components/suppliers/SupplierFormDialog"

type EditSupplierModalPageProps = {
  params: Promise<{ id: string }>
}

export default async function EditSupplierModalPage({ params }: EditSupplierModalPageProps) {
  const { id } = await params
  await requireRolePage(["ADMIN", "STOCK"])
  return <SupplierFormDialog mode="edit" supplierId={id} />
}
