"use client"

import { signOut, useSession } from "next-auth/react"
import { UserCircleIcon } from "@heroicons/react/24/solid"

type Role = "ADMIN" | "VENDEDOR" | "STOCK" | "SOCIO"

const roleLabels: Record<Role, string> = {
  ADMIN: "Administrador",
  VENDEDOR: "Vendedor",
  STOCK: "Control de Stock",
  SOCIO: "Socio",
}

export default function UserSessionMenu({ menu = "nav" }: { menu?: "nav" | "side" }) {
  const { data: session, status, update } = useSession()

  if (status === "loading") {
    return <span className="text-sm opacity-70">Cargando...</span>
  }

  if (!session?.user) {
    return null
  }

  const isAdmin = session.user.role === "ADMIN"
  const isSimulating = session.user.isSimulatingRole

  const handleActiveRoleChange = async (event: React.ChangeEvent<HTMLSelectElement>) => {
    const nextRole = event.target.value as Role
    await update({ activeRole: nextRole })
  }

  return (
    <div className={`dropdown ${menu === "nav" ? "dropdown-end" : "dropdown-right dropdown-end"}`}>
      <div tabIndex={0} role="button" className="btn btn-sm btn-ghost rounded-full px-2">
        <UserCircleIcon className="size-7" />
      </div>

      <div
        tabIndex={0}
        className="dropdown-content z-[90] mt-2 w-72 rounded-box bg-base-200 shadow-xl border border-base-300 p-4"
      >
        <div className="flex items-start gap-3">
          <UserCircleIcon className="size-10 text-base-content/70" />
          <div className="min-w-0">
            <p className="font-semibold truncate">{session.user.name ?? "Usuario"}</p>
            <p className="text-sm opacity-70 truncate">{session.user.email}</p>

            <div className="mt-2 flex flex-wrap gap-2">
              <span className="badge badge-primary badge-sm">
                Real: {roleLabels[session.user.role]}
              </span>

              <span className={`text-nowrap badge badge-sm ${isSimulating ? "badge-warning" : "badge-outline"}`}>
                Activo: {roleLabels[session.user.activeRole]}
              </span>

              {session.user.tenantId ? (
                <span className="badge badge-outline badge-sm">Tenant asignado</span>
              ) : null}
            </div>
          </div>
        </div>

        {isAdmin ? (
          <>
            <div className="divider my-3" />

            <div className="space-y-2">
              <label className="text-xs font-medium uppercase tracking-wide opacity-70">
                Simulación de rol
              </label>

              <select
                className="select select-bordered select-sm w-full"
                value={session.user.activeRole}
                onChange={handleActiveRoleChange}
              >
                <option value="ADMIN">Administrador</option>
                <option value="VENDEDOR">Vendedor</option>
                <option value="STOCK">Control de Stock</option>
                <option value="SOCIO">Socio</option>
              </select>

              {isSimulating ? (
                <div className="alert alert-warning py-2 text-xs">
                  Navegando como: {roleLabels[session.user.activeRole]}
                </div>
              ) : null}
            </div>
          </>
        ) : null}

        <div className="divider my-3" />

        <button
          className="btn btn-sm w-full"
          onClick={() => signOut({ callbackUrl: "/auth/login" })}
        >
          Cerrar sesión
        </button>
      </div>
    </div>
  )
}