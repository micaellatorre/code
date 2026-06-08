"use client"

import { useMemo, useState } from "react"
import { useSession } from "next-auth/react"
import type { Role } from "@/lib/auth/roles"
import { useConfirmDialog } from "@/components/ui/confirm-dialog"
import { getSaleOrigin, getSaleSearchText, toNumber } from "./salesUtils"
import type { SaleOriginFilter, SalesKpisValue, SaleStatusFilter, SerializedSale } from "./types"

export function useSalesList(initial: SerializedSale[]) {
  const { data: session } = useSession()
  const confirmDialog = useConfirmDialog()
  const activeRole = (session?.user as { activeRole?: Role } | undefined)?.activeRole
  const canSeeMargin = activeRole === "ADMIN" || activeRole === "SOCIO"
  const canCreate = activeRole === "ADMIN" || activeRole === "VENDEDOR"
  const canCancel = activeRole === "ADMIN"
  const canEditConfirmed = activeRole === "ADMIN"
  const canEdit = activeRole === "ADMIN" || activeRole === "VENDEDOR"

  const [sales, setSales] = useState<SerializedSale[]>(initial)
  const [searchQuery, setSearchQuery] = useState("")
  const [originFilter, setOriginFilter] = useState<SaleOriginFilter>("ALL")
  const [statusFilter, setStatusFilter] = useState<SaleStatusFilter>("ALL")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [isExportOpen, setIsExportOpen] = useState(false)
  const [receiptSale, setReceiptSale] = useState<SerializedSale | null>(null)
  const [transportSale, setTransportSale] = useState<SerializedSale | null>(null)

  const filteredSales = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    const from = dateFrom ? new Date(`${dateFrom}T00:00:00`) : null
    const to = dateTo ? new Date(`${dateTo}T23:59:59`) : null

    return sales.filter((sale) => {
      const date = sale.date ? new Date(sale.date) : null
      const matchesQuery = !query || getSaleSearchText(sale).includes(query)
      const origin = getSaleOrigin(sale)
      const matchesOrigin = originFilter === "ALL" || origin === originFilter
      const matchesStatus = statusFilter === "ALL" || sale.status === statusFilter
      const matchesDate = (!from || (date && date >= from)) && (!to || (date && date <= to))

      return matchesQuery && matchesOrigin && matchesStatus && matchesDate
    })
  }, [dateFrom, dateTo, originFilter, sales, searchQuery, statusFilter])

  const kpis = useMemo<SalesKpisValue>(() => {
    const totals = filteredSales.map((sale) => toNumber(sale.total))
    const totalSales = totals.reduce((acc, value) => acc + value, 0)
    const now = new Date()
    const monthCount = filteredSales.filter((sale) => {
      if (!sale.date) return false
      const date = new Date(sale.date)
      return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth()
    }).length

    return {
      totalSales,
      minSale: totals.length ? Math.min(...totals) : 0,
      maxSale: totals.length ? Math.max(...totals) : 0,
      monthCount,
      averageTicket: totals.length ? totalSales / totals.length : 0,
      grossMargin: filteredSales.reduce((acc, sale) => acc + toNumber(sale.profit), 0),
    }
  }, [filteredSales])

  async function cancelSale(sale: SerializedSale) {
    if (!canCancel) return

    await confirmDialog.confirmAction({
      variant: "danger",
      title: "Cancelar venta",
      description: "Esta accion marcara la venta como cancelada y recalculara sus efectos segun la API actual.",
      details: [
        { label: "Venta", value: sale.id },
        { label: "Cliente", value: sale.customerName || sale.buyer?.name || "Consumidor Final" },
        { label: "Total", value: sale.total ?? "0" },
      ],
      confirmLabel: "Cancelar venta",
      cancelLabel: "Volver",
      loadingLabel: "Cancelando...",
      onConfirm: async () => {
        const response = await fetch(`/api/sales/${sale.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "CANCELADA" }),
        })
        if (!response.ok) throw new Error(await response.text())
        setSales((prev) => prev.map((item) => (item.id === sale.id ? { ...item, status: "CANCELADA" } : item)))
      },
    })
  }

  return {
    sales,
    filteredSales,
    kpis,
    searchQuery,
    setSearchQuery,
    originFilter,
    setOriginFilter,
    statusFilter,
    setStatusFilter,
    dateFrom,
    setDateFrom,
    dateTo,
    setDateTo,
    canSeeMargin,
    canCreate,
    canCancel,
    canEdit,
    canEditConfirmed,
    activeRole,
    isExportOpen,
    setIsExportOpen,
    receiptSale,
    setReceiptSale,
    transportSale,
    setTransportSale,
    cancelSale,
  }
}
