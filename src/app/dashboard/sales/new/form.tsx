"use client"

import { useSearchParams } from "next/navigation"
import DashboardLayout from "@/components/DashboardLayout"
import Breadcrumbs from "@/components/Breadcrumbs"
import SaleForm from "@/components/sales/form/SaleForm"
import type { SaleFormSuccess } from "@/components/sales/types"

type NewSaleFormProps = {
  presentation?: "page" | "dialog"
  onSuccess?: (success: SaleFormSuccess) => void
  onCancel?: () => void
  onSubmittingChange?: (submitting: boolean) => void
}

export default function NewSaleForm({ presentation = "page", onSuccess, onCancel, onSubmittingChange }: NewSaleFormProps) {
  const searchParams = useSearchParams()
  const appointmentId = searchParams.get("appointmentId")

  const content = (
    <SaleForm
      mode="create"
      initialAppointmentId={appointmentId}
      presentation={presentation}
      onSuccess={onSuccess}
      onCancel={onCancel}
      onSubmittingChange={onSubmittingChange}
    />
  )

  if (presentation === "dialog") return content

  return (
    <DashboardLayout>
      <Breadcrumbs
        items={[
          { label: "Inicio", href: "/" },
          { label: "Ventas", href: "/dashboard/sales" },
          { label: "Nueva Venta" },
        ]}
      />
      {content}
    </DashboardLayout>
  )
}
