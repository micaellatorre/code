"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useSession } from "next-auth/react"
import type { AppointmentOutcome } from "@prisma/client"
import type { Role } from "@/lib/auth/roles"
import { useConfirmDialog } from "@/components/ui/confirm-dialog"
import { toArgDateInputValue } from "@/lib/timezone"
import {
  displayUser,
  formatAppointmentDate,
  getAppointmentReservedValue,
  getAppointmentDepositTotal,
  getInterestsSearchText,
  matchesStatusSegment,
} from "./appointmentUtils"
import type {
  AppointmentKpis,
  AppointmentStatusSegment,
  SerializedAppointment,
  UserSearchResult,
} from "./types"

export function useAppointmentsList(initial: SerializedAppointment[]) {
  const { data: session } = useSession()
  const confirmDialog = useConfirmDialog()
  const activeRole = (session?.user as { activeRole?: Role } | undefined)?.activeRole
  const isAdmin = activeRole === "ADMIN"

  const [appointments, setAppointments] = useState<SerializedAppointment[]>(initial)
  const [searchQuery, setSearchQuery] = useState("")
  const [statusSegment, setStatusSegment] = useState<AppointmentStatusSegment>("active")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [selectedCalendarDate, setSelectedCalendarDate] = useState(toArgDateInputValue(new Date()))
  const [isTableExpanded, setIsTableExpanded] = useState(false)
  const [savingOutcomeId, setSavingOutcomeId] = useState<string | null>(null)
  const [editingOutcomeId, setEditingOutcomeId] = useState<string | null>(null)
  const [cashoutAppointment, setCashoutAppointment] = useState<SerializedAppointment | null>(null)
  const [isExportModalOpen, setIsExportModalOpen] = useState(false)

  const [editingCreatedById, setEditingCreatedById] = useState<string | null>(null)
  const [userSearchQuery, setUserSearchQuery] = useState("")
  const [debouncedUserSearchQuery, setDebouncedUserSearchQuery] = useState("")
  const [userSearchResults, setUserSearchResults] = useState<UserSearchResult[]>([])
  const [isSearchingUsers, setIsSearchingUsers] = useState(false)
  const [isSavingCreatedBy, setIsSavingCreatedBy] = useState(false)
  const editorRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    setAppointments(initial)
  }, [initial])

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedUserSearchQuery(userSearchQuery.trim()), 250)
    return () => window.clearTimeout(timer)
  }, [userSearchQuery])

  useEffect(() => {
    if (!editingCreatedById || !isAdmin) {
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
  }, [debouncedUserSearchQuery, editingCreatedById, isAdmin])

  useEffect(() => {
    if (!editingCreatedById) return

    function handleClickOutside(event: MouseEvent) {
      if (editorRef.current && !editorRef.current.contains(event.target as Node) && !isSavingCreatedBy) {
        closeCreatedByEditor()
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [editingCreatedById, isSavingCreatedBy])

  const filteredAppointments = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    const from = dateFrom ? new Date(`${dateFrom}T00:00:00`) : null
    const to = dateTo ? new Date(`${dateTo}T23:59:59`) : null

    return appointments.filter((appointment) => {
      const scheduled = new Date(appointment.scheduledAt)
      const buyerText = [
        appointment.buyer?.name,
        appointment.buyer?.phone,
        appointment.buyer?.instagram,
        appointment.buyer?.email,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
      const createdByText = [appointment.createdBy, appointment.createdByUser?.email].filter(Boolean).join(" ").toLowerCase()
      const matchesQuery =
        !query ||
        buyerText.includes(query) ||
        getInterestsSearchText(appointment.interests).includes(query) ||
        createdByText.includes(query)

      const matchesDate = (!from || scheduled >= from) && (!to || scheduled <= to)

      return matchesStatusSegment(appointment, statusSegment) && matchesQuery && matchesDate
    })
  }, [appointments, dateFrom, dateTo, searchQuery, statusSegment])

  const kpis = useMemo<AppointmentKpis>(() => {
    return appointments.reduce(
      (acc, appointment) => {
        if (matchesStatusSegment(appointment, "active")) acc.activeCount += 1
        acc.reservedValue += getAppointmentReservedValue(appointment)
        acc.depositsTotal += getAppointmentDepositTotal(appointment)
        return acc
      },
      { activeCount: 0, depositsTotal: 0, reservedValue: 0 },
    )
  }, [appointments])

  function openCreatedByEditor(appointment: SerializedAppointment) {
    if (!isAdmin || isSavingCreatedBy) return
    setEditingCreatedById(appointment.id)
    setUserSearchQuery("")
    setDebouncedUserSearchQuery("")
    setUserSearchResults([])
  }

  function closeCreatedByEditor() {
    setEditingCreatedById(null)
    setUserSearchQuery("")
    setDebouncedUserSearchQuery("")
    setUserSearchResults([])
  }

  async function handleSelectCreatedBy(appointmentId: string, user: UserSearchResult) {
    if (!isAdmin) return

    setIsSavingCreatedBy(true)
    try {
      const response = await fetch(`/api/appointments/${appointmentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id }),
      })

      if (!response.ok) throw new Error(await response.text())

      const updated = (await response.json()) as { user?: SerializedAppointment["createdByUser"] | null }
      const nextUser = updated.user ?? { id: user.id, name: user.name, email: user.email }

      setAppointments((prev) =>
        prev.map((appointment) =>
          appointment.id === appointmentId
            ? { ...appointment, createdByUser: nextUser, createdBy: displayUser(nextUser) }
            : appointment,
        ),
      )

      closeCreatedByEditor()
    } catch (error) {
      console.error("Failed to update appointment user", error)
    } finally {
      setIsSavingCreatedBy(false)
    }
  }

  async function handleUpdateOutcome(appointment: SerializedAppointment, outcome: AppointmentOutcome) {
    setSavingOutcomeId(appointment.id)

    try {
      const response = await fetch(`/api/appointments/${appointment.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scheduledAt: appointment.scheduledAt,
          durationMinutes: appointment.durationMinutes,
          status: appointment.status,
          outcome,
          noSaleReason: appointment.noSaleReason,
          noSaleReasonOther: appointment.noSaleReasonOther,
          resultNotes: appointment.resultNotes,
        }),
      })

      if (!response.ok) throw new Error(await response.text())

      setAppointments((prev) => prev.map((item) => (item.id === appointment.id ? { ...item, outcome } : item)))
    } catch (error) {
      console.error("Failed to update appointment outcome", error)
    } finally {
      setSavingOutcomeId(null)
    }
  }

  async function handleDelete(id: string) {
    const appointment = appointments.find((item) => item.id === id)

    await confirmDialog.confirmAction({
      variant: "danger",
      title: "Eliminar reserva",
      description: "Esta accion eliminara la reserva de la agenda.",
      details: appointment
        ? [
            { label: "Cliente", value: appointment.buyer?.name ?? "Sin cliente" },
            { label: "Fecha", value: formatAppointmentDate(appointment.scheduledAt) },
            { label: "Estado", value: appointment.status },
          ]
        : undefined,
      banner: {
        variant: "warning",
        description: "La reserva dejara de estar disponible para seguimiento operativo.",
      },
      confirmLabel: "Eliminar",
      cancelLabel: "Cerrar",
      loadingLabel: "Eliminando...",
      onConfirm: async () => {
        const response = await fetch(`/api/appointments/${id}`, { method: "DELETE" })
        if (!response.ok) throw new Error(await response.text())
        setAppointments((prev) => prev.filter((appointment) => appointment.id !== id))
      },
    })
  }

  return {
    appointments,
    filteredAppointments,
    kpis,
    searchQuery,
    setSearchQuery,
    statusSegment,
    setStatusSegment,
    dateFrom,
    setDateFrom,
    dateTo,
    setDateTo,
    selectedCalendarDate,
    setSelectedCalendarDate,
    isTableExpanded,
    setIsTableExpanded,
    savingOutcomeId,
    editingOutcomeId,
    setEditingOutcomeId,
    handleUpdateOutcome,
    handleDelete,
    isAdmin,
    editingCreatedById,
    userSearchQuery,
    setUserSearchQuery,
    userSearchResults,
    isSearchingUsers,
    isSavingCreatedBy,
    editorRef,
    openCreatedByEditor,
    closeCreatedByEditor,
    handleSelectCreatedBy,
    cashoutAppointment,
    setCashoutAppointment,
    isExportModalOpen,
    setIsExportModalOpen,
  }
}
