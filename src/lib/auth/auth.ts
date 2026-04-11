import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { authOptions } from "./auth-options"
import { getDefaultRouteByRole } from "./roles"

export async function getAuthSession() {
  return getServerSession(authOptions)
}

/**
 * Guard base para páginas server-side.
 * Exige sesión válida y usuario activo.
 */
export async function requireAuthPage() {
  const session = await getAuthSession()

  if (!session?.user || !session.user.isActive) {
    redirect("/auth/login")
  }

  return session
}

/**
 * Guard por rol para páginas server-side.
 * Si el rol activo no está permitido, redirige
 * a la ruta principal correspondiente a ese rol.
 */
export async function requireRolePage(roles: import("./roles").Role[]) {
  const session = await requireAuthPage()
  const activeRole = session.user.activeRole
  const target = getDefaultRouteByRole(activeRole)

  if (!roles.includes(activeRole)) {
    redirect(target)
  }

  return session
}

/**
 * Guard base para API routes.
 * Devuelve 401 si no hay sesión o el usuario está inactivo.
 */
export async function requireAuthApi() {
  const session = await getAuthSession()

  if (!session?.user || !session.user.isActive) {
    return { ok: false as const, status: 401 }
  }

  return { ok: true as const, session }
}

/**
 * Guard por rol para API routes.
 * Devuelve 403 si el rol activo no está autorizado.
 */
export async function requireRoleApi(roles: import("./roles").Role[]) {
  const result = await requireAuthApi()

  if (!result.ok) return result

  if (!roles.includes(result.session.user.activeRole)) {
    return { ok: false as const, status: 403 }
  }

  return result
}