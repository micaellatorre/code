import { Suspense } from "react"
import { requireRolePage } from "@/lib/auth/auth"
import NewCommissionPlanForm from "./form"

export default async function NewCommissionPlanPage() {
  await requireRolePage(["ADMIN"])
  return (
    <Suspense fallback={<div className="p-6">Cargando formulario...</div>}>
      <NewCommissionPlanForm />
    </Suspense>
  )
}
