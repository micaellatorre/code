import type { Session } from "next-auth"

export function getEffectiveAdminTenantId(session: Session): string {
  if (session.user.activeRole !== "ADMIN") {
    throw new Error("Solo ADMIN activo puede administrar configuracion.")
  }

  if (!session.user.tenantId) {
    throw new Error("Tenant no disponible para el usuario autenticado.")
  }

  return session.user.tenantId
}
