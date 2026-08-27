import { requireRolePage } from "@/lib/auth/auth"
import BranchFormDialog from "@/components/branches/BranchFormDialog"

type EditBranchModalPageProps = {
  params: Promise<{ id: string }>
}

export default async function EditBranchModalPage({ params }: EditBranchModalPageProps) {
  const { id } = await params
  await requireRolePage(["ADMIN"])
  return <BranchFormDialog mode="edit" branchId={id} />
}
