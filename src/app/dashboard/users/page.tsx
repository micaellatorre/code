import Breadcrumbs from "@/components/Breadcrumbs"
import DashboardLayout from "@/components/DashboardLayout"
import UserBranchAdmin from "@/components/users/UserBranchAdmin"
import UsersTopSellersTable, { type SellerScoreRow } from "@/components/users/UsersTopSellersTable"
import Link from "next/link"
import { requireRolePage } from "@/lib/auth/auth"
import { resolveSessionTenantId } from "@/lib/tenant"
import prisma from "@/lib/prisma"
import { branchCreationOrder } from "@/lib/domain/branch-order"

export const dynamic = "force-dynamic"

type SellerSale = {
  id: string
  status: string
  total: unknown
  amountPaid: unknown
  balanceDue: unknown
  profit: unknown
  date: Date | null
  user: { id: string; name: string | null; email: string } | null
  branchId: string | null
  branch: { id: string; code: string; name: string } | null
}

function toNumber(value: unknown) {
  if (value == null) return 0
  if (typeof value === "number") return value
  if (typeof value === "string") return Number(value) || 0
  if (typeof value === "object" && "toNumber" in value && typeof value.toNumber === "function") return value.toNumber()
  return Number(value) || 0
}

function buildSellerScoreRows(sales: SellerSale[]): SellerScoreRow[] {
  const map = new Map<string, SellerScoreRow>()

  for (const sale of sales) {
    if (!sale.user) continue
    const branchName = sale.branch?.name ?? "Sin sucursal"
    const key = `${sale.user.id}:${sale.branchId ?? "none"}`
    const row = map.get(key) ?? {
      sellerId: sale.user.id,
      sellerName: sale.user.name ?? sale.user.email,
      sellerEmail: sale.user.email,
      branchId: sale.branchId,
      branchName,
      branchCode: sale.branch?.code ?? null,
      salesCount: 0,
      confirmedCount: 0,
      senadaCount: 0,
      total: 0,
      amountPaid: 0,
      balanceDue: 0,
      profit: 0,
      lastSaleAt: null,
    }

    row.salesCount += 1
    if (sale.status === "CONFIRMADA") row.confirmedCount += 1
    if (sale.status === "SENADA") row.senadaCount += 1
    row.total += toNumber(sale.total)
    row.amountPaid += toNumber(sale.amountPaid)
    row.balanceDue += toNumber(sale.balanceDue)
    row.profit += toNumber(sale.profit)
    const date = sale.date?.toISOString() ?? null
    if (!row.lastSaleAt || (date && date > row.lastSaleAt)) row.lastSaleAt = date

    map.set(key, row)
  }

  return Array.from(map.values())
}

export default async function UsersPage() {
  const session = await requireRolePage(["ADMIN"])
  const tenantId = await resolveSessionTenantId(session.user.tenantId)
  if (!tenantId) throw new Error("Tenant no disponible")

  const [users, branches, sellerSales, activeCommissionPlanCount] = await Promise.all([
    prisma.user.findMany({
      where: { tenantId },
      orderBy: [{ isActive: "desc" }, { name: "asc" }, { email: "asc" }],
      include: {
        currentBranch: { select: { id: true, code: true, name: true } },
        branchCoverages: { select: { branchId: true } },
      },
    }),
    prisma.branch.findMany({
      where: { tenantId, isActive: true },
      orderBy: branchCreationOrder,
      select: { id: true, code: true, name: true },
    }),
    prisma.sale.findMany({
      where: {
        tenantId,
        status: { not: "CANCELADA" },
        user: { is: { role: "VENDEDOR" } },
      },
      orderBy: { date: "desc" },
      select: {
        id: true,
        status: true,
        total: true,
        amountPaid: true,
        balanceDue: true,
        profit: true,
        date: true,
        branchId: true,
        branch: { select: { id: true, code: true, name: true } },
        user: { select: { id: true, name: true, email: true } },
      },
    }),
    prisma.closerCommissionPlan.count({ where: { tenantId, isActive: true } }),
  ])

  const sellerScoreRows = buildSellerScoreRows(sellerSales)

  return (
    <DashboardLayout>
      <Breadcrumbs items={[{ label: "Inicio", href: "/" }, { label: "Mi Equipo" }]} />
      <div className="space-y-4">
        <div className="flex flex-col gap-1">
          <div className="flex flex-row w-full justify-between items-center">
            <h1 className="text-2xl font-bold">Mi Equipo</h1>
            <Link href="/dashboard/users/new" className="btn btn-primary btn-sm">
              Nuevo usuario
            </Link>
          </div>
          <p className="text-sm text-base-content/60">Gestion de sucursal actual y cobertura operativa.</p>
        </div>
        <UserBranchAdmin
          branches={branches}
          hasCommissionPlans={activeCommissionPlanCount > 0}
          users={users.map((user) => ({
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            isActive: user.isActive,
            currentBranchId: user.currentBranchId,
            currentBranch: user.currentBranch,
            coverageBranchIds: user.branchCoverages.map((coverage) => coverage.branchId),
          }))}
        />
        <UsersTopSellersTable rows={sellerScoreRows} />
      </div>
    </DashboardLayout>
  )
}
