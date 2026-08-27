"use client"

import { useRouter } from "next/navigation"
import SupplierForm from "@/components/suppliers/SupplierForm"
import type { SupplierListItem } from "@/components/suppliers/types"

export default function EditSupplierForm({ supplier }: { supplier: SupplierListItem }) {
  const router = useRouter()

  return (
    <SupplierForm
      mode="edit"
      supplier={supplier}
      onCancel={() => router.push("/dashboard/suppliers")}
      onSuccess={() => {
        router.push("/dashboard/suppliers")
        router.refresh()
      }}
    />
  )
}
