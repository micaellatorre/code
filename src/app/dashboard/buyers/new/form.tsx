"use client"

import { useRouter } from "next/navigation"
import DashboardLayout from "@/components/DashboardLayout"
import Breadcrumbs from "@/components/Breadcrumbs"
import BuyerForm from "@/components/buyers/BuyerForm"

export default function NewBuyerForm() {
  const router = useRouter()

  return (
    <DashboardLayout>
      <Breadcrumbs
        items={[
          { label: "Inicio", href: "/" },
          { label: "Clientes", href: "/dashboard/buyers" },
          { label: "Nuevo Cliente" },
        ]}
      />
      <BuyerForm
        mode="create"
        onCancel={() => router.back()}
        onSuccess={() => {
          router.push("/dashboard/buyers")
          router.refresh()
        }}
      />
    </DashboardLayout>
  )
}
