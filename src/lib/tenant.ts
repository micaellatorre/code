import prisma from "@/lib/prisma"

export async function getDefaultTenantId() {
  const tenantId = process.env.DEFAULT_TENANT_ID?.trim()
  if (!tenantId) return null

  const tenant = await prisma.tenant.findFirst({
    where: { id: tenantId },
    select: { id: true },
  })

  return tenant?.id ?? tenantId
}

export async function resolveSessionTenantId(sessionTenantId?: string | null) {
  return sessionTenantId ?? (await getDefaultTenantId())
}
