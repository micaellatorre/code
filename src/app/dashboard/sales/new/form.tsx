"use client"

import { useSearchParams } from "next/navigation"
import DashboardLayout from "@/components/DashboardLayout"
import Breadcrumbs from "@/components/Breadcrumbs"
import SaleForm from "@/components/sales/form/SaleForm"

export default function NewSaleForm() {
  const searchParams = useSearchParams()
  const appointmentId = searchParams.get("appointmentId")

  return (
    <DashboardLayout>
      <Breadcrumbs
        items={[
          { label: "Inicio", href: "/" },
          { label: "Ventas / Canjes", href: "/dashboard/sales" },
          { label: "Nueva Venta" },
        ]}
      />
      <SaleForm mode="create" initialAppointmentId={appointmentId} />
    </DashboardLayout>
  )
}
