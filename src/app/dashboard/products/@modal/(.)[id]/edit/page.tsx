import { requireRolePage } from "@/lib/auth/auth"
import ProductFormDialog from "@/components/products/ProductFormDialog"

type EditProductModalPageProps = {
  params: Promise<{ id: string }>
}

export default async function EditProductModalPage({ params }: EditProductModalPageProps) {
  const { id } = await params
  await requireRolePage(["ADMIN", "VENDEDOR", "STOCK"])
  return <ProductFormDialog mode="edit" productId={id} />
}
