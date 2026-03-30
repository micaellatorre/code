import { getServerSession } from "next-auth"
import { authOptions } from "./auth-options"
import { redirect } from "next/navigation"

export type Role = "ADMIN" | "VENDEDOR" | "STOCK" | "SOCIO"

const defaultRouteByRole: Record<Role, string> = {
  ADMIN: "/dashboard",
  SOCIO: "/dashboard",
  VENDEDOR: "/dashboard/sales",
  STOCK: "/dashboard/products",
}

export function getDefaultRouteByRole(role: Role) {
  return defaultRouteByRole[role] ?? "/dashboard"
}

export async function getAuthSession() {
  return getServerSession(authOptions)
}

export async function requireAuthPage() {
  const session = await getAuthSession()

  if (!session?.user) {
    redirect("/auth/login")
  }

  return session
}

export async function requireRolePage(roles: Role[]) {
  const session = await requireAuthPage()
  const activeRole = session.user.activeRole

  if (!roles.includes(activeRole)) {
    redirect(getDefaultRouteByRole(activeRole))
  }

  return session
}

export async function requireRolePageWithFallback(
  roles: Role[],
  fallbackRoute?: string,
) {
  const session = await requireAuthPage()
  const activeRole = session.user.activeRole
  const target = fallbackRoute ?? getDefaultRouteByRole(activeRole)

  if (!roles.includes(activeRole)) {
    console.log("[RBAC] forbidden -> redirecting")
    redirect(target)
  }

  console.log("[RBAC] allowed -> staying on page")
  return session
}

export async function requireAuthApi() {
  const session = await getAuthSession()

  if (!session?.user) {
    return { ok: false as const, status: 401 }
  }

  return { ok: true as const, session }
}

export async function requireRoleApi(roles: Role[]) {
  const result = await requireAuthApi()

  if (!result.ok) return result

  if (!roles.includes(result.session.user.activeRole)) {
    return { ok: false as const, status: 403 }
  }

  return result
}