"use client"

import { useEffect, useState } from "react"
import DashboardLayout from "@/components/DashboardLayout"
import Breadcrumbs from "@/components/Breadcrumbs"
import SaleForm from "@/components/sales/form/SaleForm"
import type { SaleFormInitialData, SaleItemDraft, PaymentDraft } from "@/components/sales/types"
import type { Currency, PaymentMethod, SaleItemKind } from "@prisma/client"

interface EditSaleFormProps {
  id: string
}

async function readApiError(res: Response) {
  const contentType = res.headers.get("content-type") || ""
  if (contentType.includes("application/json")) {
    const data = await res.json().catch(() => null)
    return data?.error || data?.message || JSON.stringify(data)
  }
  return (await res.text().catch(() => "")) || "Error inesperado."
}

export default function EditSaleForm({ id }: EditSaleFormProps) {
  const [initialData, setInitialData] = useState<SaleFormInitialData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true

    async function loadSale() {
      setLoading(true)
      setError(null)

      try {
        const response = await fetch(`/api/sales/${id}`, { cache: "no-store" })
        if (!response.ok) throw new Error(await readApiError(response))
        const data = await response.json()
        const sale = data.sale
        if (!sale) throw new Error("No se encontro la venta.")
        if (!mounted) return

        const items: SaleItemDraft[] = Array.isArray(sale.items)
          ? sale.items.map((item: any) => ({
              productId: String(item.productId),
              product: item.product,
              units: Number(item.units || 1),
              unitPrice: item.unitPrice != null ? String(item.unitPrice) : "0",
              unitCost: item.unitCost != null ? String(item.unitCost) : "0",
              extraCost: item.extraCost != null ? String(item.extraCost) : "0",
              kind: item.kind as SaleItemKind,
              _id: String(item.id ?? `${item.productId}-${crypto.randomUUID()}`),
            }))
          : []

        const payments: PaymentDraft[] = Array.isArray(sale.payments)
          ? sale.payments.map((payment: any) => ({
              method: payment.method as PaymentMethod,
              currency: payment.currency as Currency,
              amount: payment.amount != null ? String(payment.amount) : "0",
              note: payment.note ?? undefined,
              paidAt: payment.paidAt ? new Date(payment.paidAt) : undefined,
              _id: String(payment.id ?? crypto.randomUUID()),
            }))
          : []

        setInitialData({
          id: sale.id,
          buyer: sale.buyer ?? null,
          meta: {
            date: sale.date ? new Date(sale.date) : new Date(),
            origin: sale.origin ?? "Instagram",
            notes: sale.notes ?? undefined,
          },
          items,
          payments,
          status: sale.status ?? "CONFIRMADA",
        })
      } catch (loadError: any) {
        if (mounted) setError(loadError?.message || "Error cargando la venta.")
      } finally {
        if (mounted) setLoading(false)
      }
    }

    void loadSale()
    return () => {
      mounted = false
    }
  }, [id])

  if (loading) {
    return (
      <DashboardLayout>
        <div className="p-6">Cargando venta...</div>
      </DashboardLayout>
    )
  }

  if (error || !initialData) {
    return (
      <DashboardLayout>
        <div className="alert alert-error">{error || "No se pudo cargar la venta."}</div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <Breadcrumbs
        items={[
          { label: "Inicio", href: "/" },
          { label: "Ventas / Canjes", href: "/dashboard/sales" },
          { label: "Editar Venta" },
        ]}
      />
      <SaleForm mode="edit" initialData={initialData} />
    </DashboardLayout>
  )
}
