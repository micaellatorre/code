export type Role = "ADMIN" | "VENDEDOR" | "STOCK" | "SOCIO"

export const SIMULABLE_ROLES: Role[] = ["VENDEDOR", "STOCK", "SOCIO"]

const DEFAULT_ROUTE_BY_ROLE: Record<Role, string> = {
  ADMIN: "/dashboard",
  SOCIO: "/dashboard",
  VENDEDOR: "/dashboard/sales",
  STOCK: "/dashboard/products",
}

export function getDefaultRouteByRole(role: Role) {
  return DEFAULT_ROUTE_BY_ROLE[role] ?? "/dashboard"
}