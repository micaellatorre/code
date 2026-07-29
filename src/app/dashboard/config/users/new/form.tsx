"use client"

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
        <UserForm mode="create" {...props} />
      </div>
    </DashboardLayout>
  )
}
