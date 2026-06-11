"use client"

import DashboardLayout from "@/components/DashboardLayout"
import Breadcrumbs from "@/components/Breadcrumbs"
import BuyerForm from "@/components/buyers/BuyerForm"

export default function NewBuyerForm() {
  return (
    <DashboardLayout>
      <Breadcrumbs
        items={[
          { label: "Inicio", href: "/" },
          { label: "Clientes", href: "/dashboard/buyers" },
          { label: "Nuevo Cliente" },
        ]}
      />
      <BuyerForm mode="create" />
    </DashboardLayout>
  )
}
