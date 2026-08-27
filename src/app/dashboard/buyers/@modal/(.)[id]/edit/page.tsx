import { requireRolePage } from "@/lib/auth/auth"
import BuyerFormDialog from "@/components/buyers/BuyerFormDialog"

type EditBuyerModalPageProps = {
  params: Promise<{ id: string }>
}

export default async function EditBuyerModalPage({ params }: EditBuyerModalPageProps) {
  const { id } = await params
  await requireRolePage(["ADMIN", "VENDEDOR"])
  return <BuyerFormDialog mode="edit" buyerId={id} />
}
