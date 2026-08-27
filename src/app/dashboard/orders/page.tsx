import Link from "next/link"
import type { Metadata } from "next"
import DashboardLayout from "@/components/DashboardLayout"
import Breadcrumbs from "@/components/Breadcrumbs"
import { requireRolePage } from "@/lib/auth/auth"
import { resolveSessionTenantId } from "@/lib/tenant"
import { listCustomerOrders } from "@/lib/domain/customer-orders"

export const metadata: Metadata = { title: "Pedidos", description: "Pedidos, preventas y ventas on-demand" }
export const dynamic = "force-dynamic"

const statusLabel: Record<string, string> = {
  CONFIRMED: "Confirmado",
  PROCUREMENT_PENDING: "Pendiente de compra",
  ORDERED_TO_SUPPLIER: "Comprado",
  IN_TRANSIT: "En camino",
  RECEIVED: "Recibido",
  READY_FOR_DELIVERY: "Listo para entregar",
  CONVERTED: "Entregado / vendido",
  CANCELLED: "Cancelado",
}

function usd(value: unknown) {
  const number = Number(value ?? 0)
  return `USD ${Number.isFinite(number) ? number.toFixed(2) : "0.00"}`
}

export default async function OrdersPage() {
  const session = await requireRolePage(["ADMIN", "VENDEDOR", "SOCIO"])
  const tenantId = await resolveSessionTenantId(session.user.tenantId)
  if (!tenantId) throw new Error("Tenant no disponible")
  const orders = await listCustomerOrders(tenantId)

  return (
    <DashboardLayout>
      <Breadcrumbs items={[{ label: "Inicio", href: "/" }, { label: "Pedidos" }]} />
      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Pedidos</h1>
            <p className="text-sm opacity-70">Compromisos comerciales, preventas y productos bajo demanda.</p>
          </div>
          {(session.user.activeRole === "ADMIN" || session.user.activeRole === "VENDEDOR") && (
            <Link className="btn btn-primary" href="/dashboard/orders/new">Nuevo pedido</Link>
          )}
        </div>

        <div className="overflow-x-auto rounded-box border border-base-300 bg-base-100">
          <table className="table">
            <thead><tr><th>Pedido</th><th>Cliente</th><th>Vendedor</th><th>Estado</th><th>Entrega estimada</th><th className="text-right">Total</th><th className="text-right">Saldo USD base</th></tr></thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id} className="hover">
                  <td><Link className="link link-primary font-medium" href={`/dashboard/orders/${order.id}`}>#{order.orderNumber}</Link></td>
                  <td>{order.customerNameSnapshot ?? `${order.buyer?.name ?? ""} ${order.buyer?.surname ?? ""}`.trim()}</td>
                  <td>{order.assignedSeller?.name ?? order.createdBy?.name ?? "-"}</td>
                  <td><span className="badge badge-outline">{statusLabel[order.status] ?? order.status}</span></td>
                  <td>{order.estimatedDeliveryAt ? new Intl.DateTimeFormat("es-AR").format(new Date(order.estimatedDeliveryAt)) : "-"}</td>
                  <td className="text-right">{usd(order.agreedTotalUsd)}</td>
                  <td className="text-right font-medium">{usd(order.balanceDueUsd)}</td>
                </tr>
              ))}
              {orders.length === 0 && <tr><td colSpan={7} className="py-10 text-center opacity-60">Todavía no hay pedidos.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </DashboardLayout>
  )
}
