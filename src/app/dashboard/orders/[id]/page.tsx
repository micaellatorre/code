import Link from "next/link"
import type { Metadata } from "next"
import DashboardLayout from "@/components/DashboardLayout"
import Breadcrumbs from "@/components/Breadcrumbs"
import CustomerOrderActions from "@/components/customer-orders/CustomerOrderActions"
import prisma from "@/lib/prisma"
import { requireRolePage } from "@/lib/auth/auth"
import { resolveSessionTenantId } from "@/lib/tenant"
import { getCustomerOrder } from "@/lib/domain/customer-orders"

export const metadata: Metadata = { title: "Detalle de pedido" }
export const dynamic = "force-dynamic"

const statusLabel: Record<string, string> = {
  CONFIRMED: "Confirmado", PROCUREMENT_PENDING: "Pendiente de compra", ORDERED_TO_SUPPLIER: "Comprado",
  IN_TRANSIT: "En camino", RECEIVED: "Recibido", READY_FOR_DELIVERY: "Listo para entregar",
  CONVERTED: "Entregado / vendido", CANCELLED: "Cancelado",
}

function usd(value: unknown) { const number = Number(value ?? 0); return `USD ${Number.isFinite(number) ? number.toFixed(2) : "0.00"}` }

export default async function CustomerOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireRolePage(["ADMIN", "VENDEDOR", "SOCIO"])
  const tenantId = await resolveSessionTenantId(session.user.tenantId)
  if (!tenantId) throw new Error("Tenant no disponible")
  const { id } = await params
  const order = await getCustomerOrder(tenantId, id)
  if (!order) throw new Error("Pedido no encontrado")

  const [products, cashAccounts] = await Promise.all([
    prisma.product.findMany({
      where: { tenantId, branchId: order.branchId, stockAvailable: { gt: 0 }, status: "AVAILABLE" },
      orderBy: [{ type: "asc" }, { modelName: "asc" }],
      select: { id: true, modelName: true, capacityGB: true, color: true, stockAvailable: true },
    }),
    prisma.cashAccount.findMany({
      where: { tenantId, isActive: true, OR: [{ scope: "TENANT" }, { scope: "BRANCH", branchId: order.branchId }] },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true, currency: true },
    }),
  ])

  const canOperate = session.user.activeRole === "ADMIN" || session.user.activeRole === "VENDEDOR"

  return (
    <DashboardLayout>
      <Breadcrumbs items={[{ label: "Inicio", href: "/" }, { label: "Pedidos", href: "/dashboard/orders" }, { label: `#${order.orderNumber}` }]} />
      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><div className="flex items-center gap-2"><h1 className="text-2xl font-semibold">Pedido #{order.orderNumber}</h1><span className="badge badge-outline">{statusLabel[order.status] ?? order.status}</span></div><p className="text-sm opacity-70">{order.customerNameSnapshot ?? `${order.buyer?.name ?? ""} ${order.buyer?.surname ?? ""}`.trim()} · {order.branch?.name ?? "-"}</p></div>
          <div className="flex gap-2"><Link className="btn btn-outline" target="_blank" href={`/api/customer-orders/${order.id}/receipt`}>Comprobante</Link>{order.convertedSaleId && <Link className="btn btn-primary" href={`/dashboard/sales/${order.convertedSaleId}`}>Ver venta</Link>}</div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="stat rounded-box border border-base-300 bg-base-100"><div className="stat-title">Total acordado</div><div className="stat-value text-xl">{usd(order.agreedTotalUsd)}</div></div>
          <div className="stat rounded-box border border-base-300 bg-base-100"><div className="stat-title">Pagado USD base</div><div className="stat-value text-xl">{usd(order.amountPaidUsd)}</div></div>
          <div className="stat rounded-box border border-base-300 bg-base-100"><div className="stat-title">Saldo pendiente</div><div className="stat-value text-xl">{usd(order.balanceDueUsd)}</div></div>
        </div>

        <section className="rounded-box border border-base-300 bg-base-100 p-5">
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            <div><div className="text-xs uppercase opacity-60">Cliente</div><div>{order.customerNameSnapshot}</div></div>
            <div><div className="text-xs uppercase opacity-60">DNI</div><div>{order.customerDocumentSnapshot ?? "-"}</div></div>
            <div><div className="text-xs uppercase opacity-60">Teléfono</div><div>{order.customerPhoneSnapshot ?? "-"}</div></div>
            <div><div className="text-xs uppercase opacity-60">Email</div><div>{order.customerEmailSnapshot ?? "-"}</div></div>
            <div><div className="text-xs uppercase opacity-60">Vendedor</div><div>{order.assignedSeller?.name ?? order.createdBy?.name ?? "-"}</div></div>
            <div><div className="text-xs uppercase opacity-60">Origen</div><div>{order.source}</div></div>
            <div><div className="text-xs uppercase opacity-60">Pedido</div><div>{new Intl.DateTimeFormat("es-AR").format(new Date(order.requestedAt))}</div></div>
            <div><div className="text-xs uppercase opacity-60">Entrega estimada</div><div>{order.estimatedDeliveryAt ? new Intl.DateTimeFormat("es-AR").format(new Date(order.estimatedDeliveryAt)) : "-"}</div></div>
          </div>
        </section>

        <section className="overflow-x-auto rounded-box border border-base-300 bg-base-100">
          <table className="table"><thead><tr><th>Ítem</th><th>Tipo</th><th>Cant.</th><th className="text-right">Unitario</th><th className="text-right">Total</th><th>Asignación</th></tr></thead><tbody>{order.items.map((item) => <tr key={item.id}><td>{item.descriptionSnapshot}</td><td>{item.kind === "ON_DEMAND" ? "On demand" : "Stock"}</td><td>{item.quantity}</td><td className="text-right">{usd(item.unitPriceUsd)}</td><td className="text-right">{usd(item.lineTotalUsd)}</td><td>{item.fulfilledProductId ? "Reservado / asignado" : "Pendiente"}</td></tr>)}</tbody></table>
        </section>

        <section className="overflow-x-auto rounded-box border border-base-300 bg-base-100">
          <table className="table"><thead><tr><th>Fecha</th><th>Medio</th><th>Moneda</th><th className="text-right">Importe</th><th className="text-right">Cobertura USD base</th></tr></thead><tbody>{order.payments.map((payment) => <tr key={payment.id}><td>{new Intl.DateTimeFormat("es-AR").format(new Date(payment.paidAt))}</td><td>{payment.method}</td><td>{payment.currency}</td><td className="text-right">{Number(payment.amount).toFixed(2)}</td><td className="text-right">{usd(payment.coveredBaseUsd ?? payment.amountUsd)}</td></tr>)}</tbody></table>
        </section>

        {order.deliveryDisclaimerSnapshot && <div className="alert"><span><strong>Entrega estimada:</strong> {order.deliveryDisclaimerSnapshot}</span></div>}

        {canOperate && <CustomerOrderActions orderId={order.id} status={order.status} balanceDueUsd={Number(order.balanceDueUsd)} pendingItems={order.items.filter((item) => !item.fulfilledProductId).map((item) => ({ id: item.id, description: item.descriptionSnapshot, quantity: item.quantity }))} products={products.map((product) => ({ id: product.id, label: `${product.modelName}${product.capacityGB ? ` ${product.capacityGB}GB` : ""}${product.color ? ` · ${product.color}` : ""}`, stockAvailable: product.stockAvailable }))} cashAccounts={cashAccounts.map((account) => ({ id: account.id, name: account.name, currency: account.currency }))} />}
      </div>
    </DashboardLayout>
  )
}
