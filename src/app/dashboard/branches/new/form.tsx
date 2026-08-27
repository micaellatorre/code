"use client"

import { useRouter } from "next/navigation"
import BranchForm from "@/components/branches/BranchForm"

export default function NewBranchForm() {
  const router = useRouter()

  return (
    <BranchForm
      onCancel={() => router.back()}
      onSuccess={() => {
        router.push("/dashboard/branches")
        router.refresh()
      }}
    />
  )
}
