import DashboardLayout from "@/components/DashboardLayout"
import Breadcrumbs from "@/components/Breadcrumbs"
import FilterableBuyersTable from "@/components/FilterableBuyersTable"
import prisma from "@/lib/prisma"
import type { Metadata } from "next"
import { requireRolePage } from "@/lib/auth/auth"
import { serializeBuyer } from "@/lib/buyers"

export const metadata: Metadata = {
  title: "Clientes",
  description: "Listado y gestion de clientes.",
}

export const dynamic = "force-dynamic"

async function getDefaultTenantId() {
  const tenantId = process.env.DEFAULT_TENANT_ID
  if (!tenantId) return undefined

  const tenant = await prisma.tenant.findFirst({ where: { id: tenantId } })
  return tenant?.id ?? tenantId
}

export default async function ClientsPage() {
  const session = await requireRolePage(["ADMIN", "VENDEDOR"])
  const tenantId = session.user.tenantId ?? (await getDefaultTenantId())

  const buyers = await prisma.buyer.findMany({
    where: tenantId ? { tenantId } : undefined,
    orderBy: { createdAt: "desc" },
    take: 200,
  })

  const serialized = buyers.map(serializeBuyer)

  return (
    <DashboardLayout>
      <Breadcrumbs items={[{ label: "Inicio", href: "/" }, { label: "Clientes" }]} />
      <div className="flex flex-col gap-4">
        <FilterableBuyersTable initial={serialized} />
      </div>
    </DashboardLayout>
  )
}
