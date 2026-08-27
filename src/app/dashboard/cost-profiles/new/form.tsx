"use client"

import { useRouter } from "next/navigation"
import DashboardLayout from "@/components/DashboardLayout"
import Breadcrumbs from "@/components/Breadcrumbs"
import CostProfileForm from "@/components/cost-profiles/CostProfileForm"

export default function NewCostProfileForm() {
  const router = useRouter()

  return (
    <DashboardLayout>
      <Breadcrumbs
        items={[
          { label: "Inicio", href: "/" },
          { label: "Perfiles de Costo", href: "/dashboard/cost-profiles" },
          { label: "Nuevo Perfil" },
        ]}
      />
      <div className="mx-auto max-w-xl">
        <h2 className="mb-4 text-2xl font-bold">Nuevo Perfil de Costo</h2>
        <CostProfileForm
          onCancel={() => router.back()}
          onSuccess={() => {
            router.push("/dashboard/cost-profiles")
            router.refresh()
          }}
        />
      </div>
    </DashboardLayout>
  )
}
