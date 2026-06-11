"use client"

import { useEffect, useState } from "react"
import DashboardLayout from "@/components/DashboardLayout"
import Breadcrumbs from "@/components/Breadcrumbs"
import BuyerForm, { type BuyerFormInitialData } from "@/components/buyers/BuyerForm"
import { toBuyerType } from "@/components/buyers/buyerUtils"

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

function normalizeInitialData(buyer: any): BuyerFormInitialData {
  return {
    id: String(buyer.id),
    type: toBuyerType(buyer.type),
    name: String(buyer.name ?? ""),
    surname: buyer.surname ?? null,
    businessName: buyer.businessName ?? null,
    dob: buyer.dob ?? null,
    province: buyer.province ?? null,
    city: buyer.city ?? null,
    postalCode: buyer.postalCode ?? null,
    notes: buyer.notes ?? null,
    phone: buyer.phone ?? null,
    instagram: buyer.instagram ?? null,
    email: buyer.email ?? null,
    addressStreet: buyer.addressStreet ?? null,
    addressNumber: buyer.addressNumber ?? null,
    cuit: buyer.cuit ?? null,
    dni: buyer.dni ?? null,
  }
}

export default function EditBuyerForm({ id }: EditBuyerFormProps) {
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
        if (mounted) setInitialData(normalizeInitialData(data.buyer))
      } catch (loadError: any) {
        if (mounted) setError(loadError?.message || "Error cargando el cliente.")
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
        <div className="p-6">Cargando cliente...</div>
      </DashboardLayout>
    )
  }

  if (error || !initialData) {
    return (
      <DashboardLayout>
        <Breadcrumbs items={[{ label: "Inicio", href: "/" }, { label: "Clientes", href: "/dashboard/buyers" }, { label: "Editar Cliente" }]} />
        <div className="alert alert-error">{error || "No se pudo cargar el cliente."}</div>
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
      <BuyerForm mode="edit" initialData={initialData} />
    </DashboardLayout>
  )
}
