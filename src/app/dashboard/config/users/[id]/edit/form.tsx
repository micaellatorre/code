"use client"

import { useRouter } from "next/navigation"
import UserForm, { type UserFormUser } from "@/components/users/UserForm"
import type { UserBranchOption, UserTenantOption } from "@/lib/domain/users"

type Props = {
  user: UserFormUser
  roles: ("ADMIN" | "VENDEDOR" | "STOCK" | "SOCIO")[]
  tenantOptions: UserTenantOption[]
  branches: UserBranchOption[]
  defaultTenantId: string
  defaultBranchId: string | null
}

export default function EditUserForm(props: Props) {
  const router = useRouter()

  return (
    <UserForm
      mode="edit"
      {...props}
      onCancel={() => router.push("/dashboard/config?tab=equipo")}
      onSuccess={() => {
        router.push("/dashboard/config?tab=equipo")
        router.refresh()
      }}
    />
  )
}
