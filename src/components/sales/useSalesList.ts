"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useSession } from "next-auth/react"
import type { Role } from "@/lib/auth/roles"
import { useConfirmDialog } from "@/components/ui/confirm-dialog"
import { AR_TIME_ZONE } from "@/lib/timezone"
import { formatInTimeZone } from "date-fns-tz"
import { displaySaleUser, getSaleOrigin, getSaleSearchText, toNumber } from "./salesUtils"
import type { ReceiptPreview, SaleOriginFilter, SalesKpisValue, SaleStatusFilter, SerializedSale, SerializedSaleReceipt, UserSearchResult } from "./types"
import type { BranchOption } from "@/components/branches/BranchAutocomplete"

export function useSalesList(initial: SerializedSale[]) {
  const { data: session } = useSession()
  const confirmDialog = useConfirmDialog()
  const activeRole = (session?.user as { activeRole?: Role } | undefined)?.activeRole
  const currentUserId = (session?.user as { id?: string } | undefined)?.id
  const canSeeMargin = activeRole === "ADMIN" || activeRole === "SOCIO"
  const canCreate = activeRole === "ADMIN" || activeRole === "VENDEDOR"
  const canCancel = activeRole === "ADMIN"
  const canEditConfirmed = activeRole === "ADMIN"
  const canEdit = activeRole === "ADMIN" || activeRole === "VENDEDOR"
  const isAdmin = activeRole === "ADMIN"
  const isSeller = activeRole === "VENDEDOR"

  const [sales, setSales] = useState<SerializedSale[]>(initial)
  const [searchQuery, setSearchQuery] = useState("")
  const [originFilter, setOriginFilter] = useState<SaleOriginFilter>("ALL")
  const [statusFilter, setStatusFilter] = useState<SaleStatusFilter>("ALL")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [isExportOpen, setIsExportOpen] = useState(false)
  const [receiptPreview, setReceiptPreview] = useState<ReceiptPreview | null>(null)
  const [receiptLoadingSaleId, setReceiptLoadingSaleId] = useState<string | null>(null)
  const [receiptError, setReceiptError] = useState<string | null>(null)
  const [transportSale, setTransportSale] = useState<SerializedSale | null>(null)
  const [editingSellerId, setEditingSellerId] = useState<string | null>(null)
  const [userSearchQuery, setUserSearchQuery] = useState("")
  const [debouncedUserSearchQuery, setDebouncedUserSearchQuery] = useState("")
  const [userSearchResults, setUserSearchResults] = useState<UserSearchResult[]>([])
  const [isSearchingUsers, setIsSearchingUsers] = useState(false)
  const [isSavingSeller, setIsSavingSeller] = useState(false)
  const [branches, setBranches] = useState<BranchOption[]>([])
  const [savingBranchSaleId, setSavingBranchSaleId] = useState<string | null>(null)
  const sellerEditorRef = useRef<HTMLDivElement | null>(null)
  const receiptRequestRef = useRef<string | null>(null)

  useEffect(() => {
    setSales(initial)
  }, [initial])

  useEffect(() => {
    if (!isAdmin) return
    fetch("/api/users/me/branches", { cache: "no-store" })
      .then((response) => response.json())
      .then((payload) => setBranches(Array.isArray(payload.branches) ? payload.branches : []))
      .catch(() => setBranches([]))
  }, [isAdmin])

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedUserSearchQuery(userSearchQuery.trim()), 250)
    return () => window.clearTimeout(timer)
  }, [userSearchQuery])

  useEffect(() => {
    if (!editingSellerId || !isAdmin) {
      setUserSearchResults([])
      setIsSearchingUsers(false)
      return
    }

    let ignore = false
    const ctrl = new AbortController()

    async function run() {
      setIsSearchingUsers(true)
      try {
        const params = new URLSearchParams()
        params.set("q", debouncedUserSearchQuery)
        const response = await fetch(`/api/users/search?${params.toString()}`, {
          method: "GET",
          cache: "no-store",
          signal: ctrl.signal,
        })

        if (!response.ok) throw new Error(await response.text())

        const body = (await response.json()) as { results?: UserSearchResult[] }
        if (!ignore) setUserSearchResults(Array.isArray(body.results) ? body.results : [])
      } catch (error: any) {
        if (!ignore && error?.name !== "AbortError") {
          console.error("Failed to search users", error)
          setUserSearchResults([])
        }
      } finally {
        if (!ignore) setIsSearchingUsers(false)
      }
    }

    void run()

    return () => {
      ignore = true
      ctrl.abort()
    }
  }, [debouncedUserSearchQuery, editingSellerId, isAdmin])

  useEffect(() => {
    if (!editingSellerId) return

    function handleClickOutside(event: MouseEvent) {
      if (sellerEditorRef.current && !sellerEditorRef.current.contains(event.target as Node) && !isSavingSeller) {
        closeSellerEditor()
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [editingSellerId, isSavingSeller])

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
    const kpiSales = filteredSales.filter((sale) => {
      if (sale.status === "CANCELADA") return false
      if (isSeller) return Boolean(currentUserId) && sale.createdByUser?.id === currentUserId
      return true
    })
    const totals = kpiSales.map((sale) => toNumber(sale.total))
    const totalSales = totals.reduce((acc, value) => acc + value, 0)
    const currentMonth = formatInTimeZone(new Date(), AR_TIME_ZONE, "yyyy-MM")
    const monthSales = kpiSales.filter((sale) => {
      if (!sale.date) return false
      return formatInTimeZone(new Date(sale.date), AR_TIME_ZONE, "yyyy-MM") === currentMonth
    })
    const monthSalesTotal = monthSales.reduce((acc, sale) => acc + toNumber(sale.total), 0)

    return {
      totalSales,
      monthSalesTotal,
      monthCount: monthSales.length,
      averageTicket: totals.length ? totalSales / totals.length : 0,
      grossMargin: kpiSales.reduce((acc, sale) => acc + toNumber(sale.profit), 0),
    }
  }, [currentUserId, filteredSales, isSeller])

  function openSellerEditor(sale: SerializedSale) {
    if (!isAdmin || isSavingSeller) return
    setEditingSellerId(sale.id)
    setUserSearchQuery("")
    setDebouncedUserSearchQuery("")
    setUserSearchResults([])
  }

  function closeSellerEditor() {
    setEditingSellerId(null)
    setUserSearchQuery("")
    setDebouncedUserSearchQuery("")
    setUserSearchResults([])
  }

  async function openReceipt(sale: SerializedSale) {
    if (receiptRequestRef.current) return

    setReceiptError(null)
    receiptRequestRef.current = sale.id
    setReceiptLoadingSaleId(sale.id)

    try {
      const response = await fetch(`/api/sales/${sale.id}/receipt`, {
        method: "POST",
        cache: "no-store",
      })
      const body = (await response.json().catch(() => null)) as { receipt?: SerializedSaleReceipt; error?: string } | null

      if (!response.ok || !body?.receipt) {
        throw new Error(body?.error ?? "No se pudo generar el comprobante.")
      }

      const nextSale = { ...sale, receipt: body.receipt }
      setSales((prev) => prev.map((item) => (item.id === sale.id ? nextSale : item)))
      setReceiptPreview({ sale: nextSale, receipt: body.receipt })
    } catch (error) {
      console.error("Failed to open sale receipt", error)
      setReceiptError(error instanceof Error ? error.message : "No se pudo generar el comprobante.")
    } finally {
      receiptRequestRef.current = null
      setReceiptLoadingSaleId(null)
    }
  }

  async function handleSelectSeller(saleId: string, user: UserSearchResult) {
    if (!isAdmin) return

    setIsSavingSeller(true)
    try {
      const response = await fetch(`/api/sales/${saleId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id }),
      })

      if (!response.ok) throw new Error(await response.text())

      const updated = (await response.json()) as { sale?: SerializedSale }
      const nextUser = updated.sale?.createdByUser ?? { id: user.id, name: user.name, email: user.email }

      setSales((prev) =>
        prev.map((sale) =>
          sale.id === saleId
            ? { ...sale, createdByUser: nextUser, createdBy: displaySaleUser(nextUser) }
            : sale,
        ),
      )

      closeSellerEditor()
    } catch (error) {
      console.error("Failed to update sale seller", error)
    } finally {
      setIsSavingSeller(false)
    }
  }

  async function handleSelectBranch(saleId: string, branchId: string) {
    if (!isAdmin) return
    const branch = branches.find((item) => item.id === branchId)
    if (!branch) return

    setSavingBranchSaleId(saleId)
    try {
      const response = await fetch(`/api/sales/${saleId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ branchId }),
      })
      const body = await response.json().catch(() => null)
      if (!response.ok) throw new Error(body?.error ?? "No se pudo actualizar la sucursal.")

      setSales((prev) => prev.map((sale) => (sale.id === saleId ? { ...sale, branchId, branch } : sale)))
    } catch (error) {
      console.error("Failed to update sale branch", error)
    } finally {
      setSavingBranchSaleId(null)
    }
  }

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

  function updateSale(nextSale: SerializedSale) {
    setSales((prev) => prev.map((sale) => (sale.id === nextSale.id ? nextSale : sale)))
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
    isAdmin,
    isSeller,
    isExportOpen,
    setIsExportOpen,
    receiptPreview,
    setReceiptPreview,
    receiptLoadingSaleId,
    receiptError,
    openReceipt,
    transportSale,
    setTransportSale,
    sellerEditor: {
      editingSellerId,
      isSearchingUsers,
      isSavingSeller,
      userSearchQuery,
      userSearchResults,
      editorRef: sellerEditorRef,
      onOpen: openSellerEditor,
      onClose: closeSellerEditor,
      onUserSearchQueryChange: setUserSearchQuery,
      onSelectUser: handleSelectSeller,
    },
    branchEditor: {
      branches,
      savingBranchSaleId,
      onSelectBranch: handleSelectBranch,
    },
    editingSellerId,
    userSearchQuery,
    setUserSearchQuery,
    userSearchResults,
    isSearchingUsers,
    isSavingSeller,
    sellerEditorRef,
    openSellerEditor,
    closeSellerEditor,
    handleSelectSeller,
    updateSale,
    cancelSale,
  }
}
