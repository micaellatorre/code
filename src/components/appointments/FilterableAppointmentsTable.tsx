"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { useSession } from "next-auth/react"
import { PencilIcon, TrashIcon, ArrowsPointingInIcon, ArrowsPointingOutIcon } from "@heroicons/react/24/solid"
import type { AppointmentOutcome, AppointmentStatus } from "@prisma/client"
import type { Role } from "@/lib/auth/roles"
import { formatInTimeZone } from "date-fns-tz"
import { AR_TIME_ZONE } from "@/lib/timezone"

type AppointmentInterestSummary = {
  id: string
  productId: string
  priority: number | null
  notes: string | null
  product: {
    id: string
    type: string
    modelName: string
  }
}

type AppointmentUserSummary = {
  id: string
  name: string | null
  email: string
}

type SerializedAppointment = {
  id: string
  scheduledAt: string
  durationMinutes: number | null
  status: AppointmentStatus
  outcome: AppointmentOutcome
  noSaleReason: string | null
  buyer: {
    id: string
    name: string
    phone: string | null
    instagram: string | null
  } | null
  interests: AppointmentInterestSummary[]
  resultNotes: string | null
  createdBy: string
  createdByUser: AppointmentUserSummary | null
}

type UserSearchResult = {
  id: string
  name: string | null
  email: string
  role: Role
}

const OUTCOME_OPTIONS: AppointmentOutcome[] = [
  "PENDIENTE",
  "VENTA_CONCRETADA",
  "NO_SE_CONCRETO",
  "SENADO",
  "SENADO_EN_CAMINO",
  "SENADO_EN_STOCK",
]

function displayUser(user: AppointmentUserSummary | null) {
  if (!user) return "-"
  return user.name?.trim() || user.email
}

function getInterestsSearchText(interests: AppointmentInterestSummary[]) {
  return interests
    .map((interest) => [interest.product?.modelName, interest.product?.type, interest.notes].filter(Boolean).join(" "))
    .join(" ")
    .toLowerCase()
}

function ProductTypeIcon({ type }: { type: string }) {
  if (type.toUpperCase() === "PHONE") {
    return (
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="size-4 shrink-0">
        <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 0 0 6 3.75v16.5a2.25 2.25 0 0 0 2.25 2.25h7.5A2.25 2.25 0 0 0 18 20.25V3.75a2.25 2.25 0 0 0-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3" />
      </svg>
    )
  }

  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="size-4 shrink-0">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5V6a3.75 3.75 0 1 0-7.5 0v4.5m11.356-1.993 1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 0 1-1.12-1.243l1.264-12A1.125 1.125 0 0 1 5.513 7.5h12.974c.576 0 1.059.435 1.119 1.007ZM8.625 10.5a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm7.5 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
    </svg>
  )
}

export default function FilterableAppointmentsTable({ initial }: { initial: SerializedAppointment[] }) {
  const { data: session } = useSession()
  const activeRole = (session?.user as { activeRole?: Role } | undefined)?.activeRole
  const isAdmin = activeRole === "ADMIN"

  const [appointments, setAppointments] = useState<SerializedAppointment[]>(initial)
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<AppointmentStatus | "ALL">("ALL")
  const [outcomeFilter, setOutcomeFilter] = useState<AppointmentOutcome | "ALL">("ALL")
  const [isTableExpanded, setIsTableExpanded] = useState(false)
  const [savingOutcomeId, setSavingOutcomeId] = useState<string | null>(null)
  const [editingOutcomeId, setEditingOutcomeId] = useState<string | null>(null)

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

        if (!response.ok) {
          throw new Error(await response.text())
        }

        const body = (await response.json()) as { results?: UserSearchResult[] }
        if (!ignore) {
          setUserSearchResults(Array.isArray(body.results) ? body.results : [])
        }
      } catch (error: any) {
        if (!ignore && error?.name !== "AbortError") {
          console.error("Failed to search users", error)
          setUserSearchResults([])
        }
      } finally {
        if (!ignore) {
          setIsSearchingUsers(false)
        }
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
    return appointments.filter((a) => {
      const query = searchQuery.toLowerCase()
      const matchesQuery =
        !query ||
        a.buyer?.name.toLowerCase().includes(query) ||
        a.buyer?.phone?.toLowerCase().includes(query) ||
        a.buyer?.instagram?.toLowerCase().includes(query) ||
        getInterestsSearchText(a.interests).includes(query) ||
        a.createdBy.toLowerCase().includes(query)

      const matchesStatus = statusFilter === "ALL" || a.status === statusFilter
      const matchesOutcome = outcomeFilter === "ALL" || a.outcome === outcomeFilter

      return matchesQuery && matchesStatus && matchesOutcome
    })
  }, [appointments, searchQuery, statusFilter, outcomeFilter])
  function formatDate(iso: string) {
    const date = new Date(iso)
    if (Number.isNaN(date.getTime())) return "Fecha inválida"
    return formatInTimeZone(date, AR_TIME_ZONE, "dd/MM/yyyy HH:mm")
  }

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

      if (!response.ok) {
        throw new Error(await response.text())
      }

      const updated = (await response.json()) as {
        user?: AppointmentUserSummary | null
      }

      const nextUser = updated.user
        ? {
          id: updated.user.id,
          name: updated.user.name,
          email: updated.user.email,
        }
        : {
          id: user.id,
          name: user.name,
          email: user.email,
        }

      setAppointments((prev) =>
        prev.map((appointment) =>
          appointment.id === appointmentId
            ? {
              ...appointment,
              createdByUser: nextUser,
              createdBy: displayUser(nextUser),
            }
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
          noSaleReasonOther: undefined,
          resultNotes: appointment.resultNotes,
        }),
      })

      if (!response.ok) {
        throw new Error(await response.text())
      }

      const updated = (await response.json()) as SerializedAppointment
      setAppointments((prev) => prev.map((a) => (a.id === appointment.id ? { ...a, outcome: updated.outcome } : a)))
    } catch (error) {
      console.error("Failed to update appointment outcome", error)
    } finally {
      setSavingOutcomeId(null)
    }
  }

  async function handleDelete(id: string) {
    if (window.confirm("¿Estás seguro de que quieres eliminar esta cita?")) {
      try {
        const response = await fetch(`/api/appointments/${id}`, {
          method: "DELETE",
        })

        if (response.ok) {
          setAppointments((prev) => prev.filter((a) => a.id !== id))
        } else {
          console.error("Failed to delete appointment")
        }
      } catch (error) {
        console.error("An error occurred:", error)
      }
    }
  }

  return (
    <div className="card bg-base-100">
      <div className="flex flex-row items-center gap-2">
        <div className="flex flex-wrap items-center gap-4 w-full">
          <h2 className="text-2xl font-bold hidden sm:block">
            Citas
          </h2>
          <div className="flex flex-wrap gap-2 sm:gap-4 rounded-box bg-base-200 p-2 items-center">
            <div className="flex flex-row items-center gap-1">
              <span className="ml-1 text-sm text-base-content/60">
                Resultados {filteredAppointments.length}
              </span>
              <span className="text-sm text-base-content/30">de</span>
              <span className="text-sm text-base-content/30">
                {appointments.length}
              </span>
            </div>
            <div className="divider divider-horizontal mx-0 hidden sm:block" />
            <button
              type="button"
              className="btn btn-ghost btn-outline border border-base-content/10 h-[2.4em] flex items-center btn-xs sm:btn-sm"
              onClick={() => setIsTableExpanded(!isTableExpanded)}
              title={isTableExpanded ? "Contraer tabla" : "Expandir tabla"}
            >
              {isTableExpanded ? 'Comprimir' : 'Expandir '} Tabla
              {isTableExpanded ? (
                <ArrowsPointingInIcon className="size-6" />
              ) : (
                <ArrowsPointingOutIcon className="size-6" />
              )}
            </button>
            <Link href="/dashboard/appointments/new" className="btn btn-primary btn-sm sm:hidden">
              Nueva Cita
            </Link>
          </div>
        </div>

        <Link href="/dashboard/appointments/new" className="btn btn-primary hidden sm:inline-flex">
          Nueva Cita
        </Link>
      </div>

      {/* Filtros de búsqueda */}
      <div className="my-2 sm:my-4 flex flex-wrap gap-2 sm:gap-4 rounded-box bg-base-200 p-2">
        <input
          type="text"
          placeholder="Buscar por cliente, contacto o interés..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="input input-bordered input-sm flex-grow"
        />
        <select
          className="select select-bordered select-xs sm:select-sm"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as AppointmentStatus | "ALL")}
        >
          <option value="ALL">Todos los Estados</option>
          {["PROGRAMADA", "CONCRETADA", "CANCELADA", "NO_SE_PRESENTO"].map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
        <select
          className="select select-bordered select-xs sm:select-sm"
          value={outcomeFilter}
          onChange={(e) => setOutcomeFilter(e.target.value as AppointmentOutcome | "ALL")}
        >
          <option value="ALL">Todos los Resultados</option>
          {OUTCOME_OPTIONS.map((outcome) => (
            <option key={outcome} value={outcome}>
              {outcome}
            </option>
          ))}
        </select>
      </div>

      <div className="overflow-x-auto">
        <table className={`table table-zebra w-full table-pin-rows table-pin-cols ${isTableExpanded ? "" : "table-xs"}`}>
          <thead>
            <tr>
              <th>Fecha y Hora</th>
              <th>Creada por</th>
              <th>Cliente</th>
              <th>Contacto</th>
              <th>Intereses</th>
              <th>Estado</th>
              <th>Resultado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filteredAppointments.map((appointment) => {
              const isEditingCreatedBy = editingCreatedById === appointment.id

              return (
                <tr key={appointment.id}>
                  <td>{formatDate(appointment.scheduledAt)}</td>
                  <td className="align-top">
                    {!isAdmin ? (
                      appointment.createdBy || "-"
                    ) : isEditingCreatedBy ? (
                      <div ref={editorRef} className="relative min-w-[18rem]">
                        <input
                          type="text"
                          autoFocus
                          value={userSearchQuery}
                          onChange={(e) => setUserSearchQuery(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Escape" && !isSavingCreatedBy) {
                              closeCreatedByEditor()
                            }
                          }}
                          placeholder="Buscar usuario..."
                          disabled={isSavingCreatedBy}
                          className="input input-bordered input-sm w-full"
                        />
                        <div className="absolute z-20 mt-1 w-full rounded-box border border-base-300 bg-base-100 shadow-lg">
                          {isSavingCreatedBy ? (
                            <div className="px-3 py-2 text-sm text-base-content/70">Guardando...</div>
                          ) : isSearchingUsers ? (
                            <div className="px-3 py-2 text-sm text-base-content/70">Buscando...</div>
                          ) : userSearchResults.length === 0 ? (
                            <div className="px-3 py-2 text-sm text-base-content/70">Sin resultados</div>
                          ) : (
                            <ul className="max-h-60 overflow-y-auto py-1">
                              {userSearchResults.map((user) => (
                                <li key={user.id}>
                                  <button
                                    type="button"
                                    className="flex w-full items-start justify-between gap-3 px-3 py-2 text-left hover:bg-base-200 disabled:cursor-not-allowed disabled:opacity-60"
                                    onClick={() => handleSelectCreatedBy(appointment.id, user)}
                                    disabled={isSavingCreatedBy}
                                  >
                                    <span className="flex min-w-0 flex-col">
                                      <span className="truncate text-sm font-medium">{user.name?.trim() || user.email}</span>
                                      <span className="truncate text-xs text-base-content/60">{user.email}</span>
                                    </span>
                                    <span className="badge badge-outline badge-sm shrink-0">{user.role}</span>
                                  </button>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="cursor-pointer rounded px-1 text-left hover:bg-base-200"
                        onClick={() => openCreatedByEditor(appointment)}
                        title="Click para reasignar"
                      >
                        {appointment.createdBy || "-"}
                      </button>
                    )}
                  </td>
                  <td>
                    {appointment.buyer ? (
                      <Link
                        href={`/dashboard/buyers/${appointment.buyer?.id}/edit`}
                        className="font-medium text-primary hover:underline"
                      >
                        {appointment.buyer.name}
                      </Link>
                    ) : (
                      "-"
                    )}
                  </td>
                  <td>
                    {appointment.buyer?.phone ? <div>📞 {appointment.buyer.phone}</div> : null}
                    {appointment.buyer?.instagram &&
                      <div className="flex items-center gap-1">
                        <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24"
                          className="fill-primary shrink-0" ><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" /></svg>
                        <a
                          href={`https://www.instagram.com/${appointment.buyer.instagram}`}
                          target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline">
                          @{appointment.buyer.instagram}
                        </a>
                      </div>
                    }
                  </td>
                  <td>
                    {Array.isArray(appointment.interests) && appointment.interests.length > 0 ? (
                      <div className="dropdown dropdown-hover">
                        <div tabIndex={0} role="button" className="btn btn-xs m-1">
                          {appointment.interests.length} items
                        </div>
                        <ul tabIndex={-1} className="dropdown-content z-[1] menu p-2 shadow bg-base-100 rounded-box w-60">
                          {appointment.interests.map((interest, idx) => {
                            const key = interest.id ?? interest.productId ?? `${interest.product?.modelName ?? "item"}-${idx}`

                            return (
                              <li key={String(key)}>
                                <Link
                                  href={`/dashboard/products/${interest.productId}/edit`}
                                  className="btn btn-xs btn-ghost gap-1 flex flex-row justify-between"
                                  target="_blank"
                                  rel="noopener noreferrer"
                                >
                                  <ProductTypeIcon type={interest.product?.type ?? ""} />
                                  <span className="text-left truncate w-full max-w-[10rem]">
                                    {interest.product?.modelName ?? "-"}
                                  </span>
                                  {interest.priority ? <span>#{interest.priority}</span> : null}
                                </Link>
                              </li>
                            )
                          })}
                        </ul>
                      </div>
                    ) : (
                      "-"
                    )}
                  </td>
                  <td>
                    <span className={`badge badge-outline badge-${appointment.status === "CONCRETADA" ? "success" : "warning"}`}>
                      {appointment.status}
                    </span>
                  </td>
                  <td>
                    {editingOutcomeId === appointment.id ? (
                      <select
                        className="select select-bordered select-xs w-full"
                        value={appointment.outcome}
                        disabled={savingOutcomeId === appointment.id}
                        onChange={(e) => {
                          handleUpdateOutcome(appointment, e.target.value as AppointmentOutcome)
                          setEditingOutcomeId(null)
                        }}
                        onBlur={() => setEditingOutcomeId(null)}
                      >
                        {OUTCOME_OPTIONS.map((outcome) => (
                          <option key={outcome} value={outcome}>
                            {outcome}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <button
                        type="button"
                        className={`badge badge-outline badge-${appointment.outcome === 'VENTA_CONCRETADA' ? 'success' : appointment.outcome === 'NO_SE_CONCRETO' ? 'error' : 'ghost'} cursor-pointer`}
                        onClick={() => setEditingOutcomeId(appointment.id)}
                      >
                        {appointment.outcome}
                      </button>
                    )}
                  </td>
                  <td>
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/dashboard/appointments/${appointment.id}/edit`}
                        className="btn btn-xs btn-square btn-soft"
                        title="Editar"
                      >
                        <PencilIcon className="size-[1.2em]" />
                      </Link>
                      <button
                        onClick={() => handleDelete(appointment.id)}
                        className="btn btn-xs btn-square btn-soft btn-error"
                        title="Eliminar"
                      >
                        <TrashIcon className="size-[1.2em]" />
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
            {filteredAppointments.length === 0 && (
              <tr>
                <td colSpan={8} className="text-center">
                  No se encontraron citas.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

    </div>
  )
}
