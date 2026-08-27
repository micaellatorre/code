"use client"

import { useRouter } from "next/navigation"
import BranchForm, { type BranchFormValue } from "@/components/branches/BranchForm"

export default function EditBranchForm({ initial }: { initial: BranchFormValue }) {
  const router = useRouter()

  return (
    <BranchForm
      initial={initial}
      onCancel={() => router.back()}
      onSuccess={() => {
        router.push("/dashboard/branches")
        router.refresh()
      }}
    />
  )
}
