import type { Metadata } from "next"
import DashboardLayout from "@/components/DashboardLayout"
import Breadcrumbs from "@/components/Breadcrumbs"
import CustomerOrderCreateForm from "@/components/customer-orders/CustomerOrderCreateForm"
import prisma from "@/lib/prisma"
import { requireRolePage } from "@/lib/auth/auth"
import { resolveSessionTenantId } from "@/lib/tenant"
import { resolveUserBranchContext } from "@/lib/domain/user-branches"
import { getCustomerOrderSettings } from "@/lib/domain/customer-orders"

export const metadata: Metadata = { title: "Nuevo pedido" }
export const dynamic = "force-dynamic"

export default async function NewCustomerOrderPage() {
  const session = await requireRolePage(["ADMIN", "VENDEDOR"])
  const tenantId = await resolveSessionTenantId(session.user.tenantId)
  if (!tenantId) throw new Error("Tenant no disponible")
  const branchContext = await resolveUserBranchContext({ userId: session.user.id, tenantId, role: session.user.activeRole })
  if (!branchContext.currentBranch) throw new Error("Selecciona una sucursal actual antes de crear un pedido.")
  const branchId = branchContext.currentBranch.id

  const [buyers, products, cashAccounts, settings] = await Promise.all([
    prisma.buyer.findMany({
      where: { tenantId, type: "MINORISTA" },
      orderBy: [{ name: "asc" }, { surname: "asc" }],
      select: { id: true, name: true, surname: true, dni: true, phone: true, email: true },
    }),
    prisma.product.findMany({
      where: { tenantId, branchId, type: "ACCESSORY", stockAvailable: { gt: 0 }, status: "AVAILABLE", state: { in: ["EN_STOCK", "DISPONIBLE"] } },
      orderBy: { modelName: "asc" },
      select: { id: true, modelName: true, color: true, salePrice: true, stockAvailable: true },
    }),
    prisma.cashAccount.findMany({
      where: { tenantId, isActive: true, OR: [{ scope: "TENANT" }, { scope: "BRANCH", branchId }] },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true, currency: true },
    }),
    getCustomerOrderSettings(tenantId),
  ])

  return (
    <DashboardLayout>
      <Breadcrumbs items={[{ label: "Inicio", href: "/" }, { label: "Pedidos", href: "/dashboard/orders" }, { label: "Nuevo pedido" }]} />
      <div className="mb-5"><h1 className="text-2xl font-semibold">Nuevo pedido</h1><p className="text-sm opacity-70">Registra una preventa o producto bajo demanda y reserva los accesorios disponibles.</p></div>
      <CustomerOrderCreateForm
        branchId={branchId}
        defaultDeliveryDays={settings.customerOrderDefaultDeliveryDays}
        buyers={buyers.map((buyer) => ({ id: buyer.id, label: `${buyer.name} ${buyer.surname ?? ""}`.trim(), dni: buyer.dni, phone: buyer.phone, email: buyer.email }))}
        products={products.map((product) => ({ id: product.id, label: `${product.modelName}${product.color ? ` · ${product.color}` : ""}`, salePrice: product.salePrice.toString(), stockAvailable: product.stockAvailable }))}
        cashAccounts={cashAccounts.map((account) => ({ id: account.id, name: account.name, currency: account.currency }))}
      />
    </DashboardLayout>
  )
}
