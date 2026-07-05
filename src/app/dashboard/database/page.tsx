import type { Metadata } from "next"
import Breadcrumbs from "@/components/Breadcrumbs"
import DashboardLayout from "@/components/DashboardLayout"
import DatabaseModule from "@/components/database/DatabaseModule"
import { requireRolePage } from "@/lib/auth/auth"
import { resolveSessionTenantId } from "@/lib/tenant"
import {
  canSeeDatabaseFinancials,
  getDatabaseReadModel,
  normalizeDatabasePeriod,
  resolveDatabaseDateRange,
  type DatabaseTabKey,
} from "@/lib/database/read-models"

export const metadata: Metadata = {
  title: "Base de Datos",
  description: "Reportes financieros y trazabilidad",
}

export const dynamic = "force-dynamic"

const tabs: DatabaseTabKey[] = ["cash", "retail", "wholesale", "purchases", "reservations", "closers", "service", "audit", "buyers"]

function normalizeTab(value: string | string[] | undefined): DatabaseTabKey {
  const current = Array.isArray(value) ? value[0] : value
  return tabs.includes(current as DatabaseTabKey) ? (current as DatabaseTabKey) : "cash"
}

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

export default async function DatabasePage({ searchParams }: PageProps) {
  const session = await requireRolePage(["ADMIN", "SOCIO", "VENDEDOR", "STOCK"])
  const params = (await searchParams) ?? {}
  const tenantId = await resolveSessionTenantId(session.user.tenantId)

  if (!tenantId) {
    throw new Error("Tenant no disponible para Base de Datos")
  }

  const period = normalizeDatabasePeriod(params.period)
  const from = Array.isArray(params.from) ? params.from[0] : params.from
  const to = Array.isArray(params.to) ? params.to[0] : params.to
  const range = resolveDatabaseDateRange(period, from, to)
  const activeTab = normalizeTab(params.tab)
  const data = await getDatabaseReadModel({
    tenantId,
    range,
    role: session.user.activeRole,
  })

  return (
    <DashboardLayout>
      <Breadcrumbs items={[{ label: "Inicio", href: "/" }, { label: "Base de Datos" }]} />
      <DatabaseModule
        data={data}
        range={range}
        activeTab={activeTab}
        period={period}
        dateFrom={from ?? range.from.toISOString().slice(0, 10)}
        dateTo={to ?? range.to.toISOString().slice(0, 10)}
        canSeeFinancials={canSeeDatabaseFinancials(session.user.activeRole)}
        reporter={session.user.name || session.user.email || "Usuario autenticado"}
      />
    </DashboardLayout>
  )
}
