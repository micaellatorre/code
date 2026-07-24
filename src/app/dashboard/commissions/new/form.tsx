"use client"

import Breadcrumbs from "@/components/Breadcrumbs"
import DashboardLayout from "@/components/DashboardLayout"
import CommissionPlanForm from "@/components/commissions/CommissionPlanForm"

export default function NewCommissionPlanForm() {
  return (
    <DashboardLayout>
      <Breadcrumbs
        items={[
          { label: "Inicio", href: "/" },
          { label: "Comisiones", href: "/dashboard/commissions" },
          { label: "Nuevo plan" },
        ]}
      />
      <div className="mx-auto max-w-4xl space-y-5">
        <div>
          <h1 className="text-2xl font-bold">Nuevo plan de comision</h1>
          <p className="text-sm text-base-content/60">Configura la regla base antes de asignar comisiones a vendedores.</p>
        </div>
        <CommissionPlanForm />
      </div>
    </DashboardLayout>
  )
}
