import { requireRolePage } from "@/lib/auth/auth"
import NewCommissionPlanForm from "./form"

export default async function NewCommissionPlanPage() {
  await requireRolePage(["ADMIN"])
  return <NewCommissionPlanForm />
}
