import CustomerOrderFormDialog from "@/components/customer-orders/CustomerOrderFormDialog"
import prisma from "@/lib/prisma"
import { requireRolePage } from "@/lib/auth/auth"
import { resolveSessionTenantId } from "@/lib/tenant"
import { resolveUserBranchContext } from "@/lib/domain/user-branches"
import { getCustomerOrderSettings } from "@/lib/domain/customer-orders"

export const dynamic = "force-dynamic"

export default async function NewCustomerOrderModalPage() {
  const session = await requireRolePage(["ADMIN", "VENDEDOR"])
  const tenantId = await resolveSessionTenantId(session.user.tenantId)
  if (!tenantId) throw new Error("Tenant no disponible")
  const branchContext = await resolveUserBranchContext({ userId: session.user.id, tenantId, role: session.user.activeRole })
  if (!branchContext.currentBranch) throw new Error("Selecciona una sucursal actual antes de crear un pedido.")
  const branchId = branchContext.currentBranch.id

  const [products, settings] = await Promise.all([
    prisma.product.findMany({
      where: { tenantId, branchId, type: "ACCESSORY", stockAvailable: { gt: 0 }, status: "AVAILABLE", state: { in: ["EN_STOCK", "DISPONIBLE"] } },
      orderBy: { modelName: "asc" },
      select: { id: true, modelName: true, color: true, salePrice: true, stockAvailable: true },
    }),
    getCustomerOrderSettings(tenantId),
  ])

  return (
    <CustomerOrderFormDialog
      branchId={branchId}
      defaultDeliveryDays={settings.customerOrderDefaultDeliveryDays}
      products={products.map((product) => ({ id: product.id, label: `${product.modelName}${product.color ? ` · ${product.color}` : ""}`, salePrice: product.salePrice.toString(), stockAvailable: product.stockAvailable }))}
    />
  )
}
