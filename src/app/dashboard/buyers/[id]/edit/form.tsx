"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import DashboardLayout from "@/components/DashboardLayout"
import Breadcrumbs from "@/components/Breadcrumbs"
import BuyerForm, { normalizeBuyerFormInitialData, type BuyerFormInitialData } from "@/components/buyers/BuyerForm"

type EditBuyerFormProps = {
  id: string
}

async function readApiError(response: Response) {
  const contentType = response.headers.get("content-type") || ""
  if (contentType.includes("application/json")) {
    const body = await response.json().catch(() => null)
    return body?.error || body?.message || "Error inesperado."
  }
  return (await response.text().catch(() => "")) || "Error inesperado."
}

export default function EditBuyerForm({ id }: EditBuyerFormProps) {
  const router = useRouter()
  const [initialData, setInitialData] = useState<BuyerFormInitialData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true

    async function loadBuyer() {
      setLoading(true)
      setError(null)

      try {
        const response = await fetch(`/api/buyers/${id}`, { cache: "no-store" })
        if (!response.ok) throw new Error(await readApiError(response))
        const data = await response.json()
        if (!data?.buyer) throw new Error("No se encontro el cliente.")
        if (mounted) setInitialData(normalizeBuyerFormInitialData(data.buyer))
      } catch (loadError) {
        if (mounted) setError(loadError instanceof Error ? loadError.message : "Error cargando el cliente.")
      } finally {
        if (mounted) setLoading(false)
      }
    }

    void loadBuyer()
    return () => {
      mounted = false
    }
  }, [id])

  if (loading) {
    return (
      <DashboardLayout>
        <Breadcrumbs items={[{ label: "Inicio", href: "/" }, { label: "Clientes", href: "/dashboard/buyers" }, { label: "Editar Cliente" }]} />
        <div className="flex items-center justify-center py-10">
          <span className="loading loading-spinner loading-lg"></span>
        </div>
      </DashboardLayout>
    )
  }

  if (error || !initialData) {
    return (
      <DashboardLayout>
        <Breadcrumbs items={[{ label: "Inicio", href: "/" }, { label: "Clientes", href: "/dashboard/buyers" }, { label: "Editar Cliente" }]} />
        <div className="p-4">
          <div className="alert alert-error">{error || "No se pudo cargar el cliente."}</div>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <Breadcrumbs
        items={[
          { label: "Inicio", href: "/" },
          { label: "Clientes", href: "/dashboard/buyers" },
          { label: "Editar Cliente" },
        ]}
      />
      <BuyerForm
        mode="edit"
        initialData={initialData}
        onCancel={() => router.back()}
        onSuccess={() => {
          router.push("/dashboard/buyers")
          router.refresh()
        }}
      />
    </DashboardLayout>
  )
}
