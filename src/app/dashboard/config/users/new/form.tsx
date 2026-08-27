"use client"

import { useRouter } from "next/navigation"
import Breadcrumbs from "@/components/Breadcrumbs"
import DashboardLayout from "@/components/DashboardLayout"
import UserForm from "@/components/users/UserForm"
import type { UserBranchOption, UserTenantOption } from "@/lib/domain/users"

type Props = {
  roles: ("ADMIN" | "VENDEDOR" | "STOCK" | "SOCIO")[]
  tenantOptions: UserTenantOption[]
  branches: UserBranchOption[]
  defaultTenantId: string
  defaultBranchId: string | null
}

export default function NewUserForm(props: Props) {
  const router = useRouter()

  return (
    <DashboardLayout>
      <Breadcrumbs
        items={[
          { label: "Inicio", href: "/" },
          { label: "Configuracion", href: "/dashboard/config?tab=equipo" },
          { label: "Nuevo usuario" },
        ]}
      />
      <div className="mx-auto max-w-4xl space-y-5">
        <div>
          <h1 className="text-2xl font-bold">Nuevo usuario</h1>
          <p className="text-sm text-base-content/60">Crea accesos operativos y asigna el contexto inicial de sucursal.</p>
        </div>
        <UserForm
          mode="create"
          {...props}
          onCancel={() => router.push("/dashboard/config?tab=equipo")}
          onSuccess={(user) => {
            router.push(`/dashboard/config/users/new/success?userId=${encodeURIComponent(user.id)}`)
            router.refresh()
          }}
        />
      </div>
    </DashboardLayout>
  )
}
