import Link from "next/link"
import DashboardLayout from "@/components/DashboardLayout"
import Breadcrumbs from "@/components/Breadcrumbs"
import SearchBar from "@/components/SearchBar"
import prisma from "@/lib/prisma"
import { requireRolePage } from "@/lib/auth/auth"
import { resolveSessionTenantId } from "@/lib/tenant"
import { formatInTimeZone } from "date-fns-tz"
import { AR_TIME_ZONE } from "@/lib/timezone"
import { canSeeDatabaseFinancials } from "@/lib/database/read-models"

export const dynamic = "force-dynamic"

const statusLabels: Record<string, string> = {
  RECEIVED: "Recibido",
  IN_WORKSHOP: "En taller",
  IN_PROGRESS: "En progreso",
  WAITING_PARTS: "Esperando repuesto",
  READY: "Listo",
  DELIVERED: "Entregado",
  CANCELLED: "Cancelado",
}

const statusClasses: Record<string, string> = {
  RECEIVED: "badge-info",
  IN_WORKSHOP: "badge-warning",
  IN_PROGRESS: "badge-primary",
  WAITING_PARTS: "badge-secondary",
  READY: "badge-success",
  DELIVERED: "badge-success",
  CANCELLED: "badge-error",
}

export default async function ServiceOrdersPage() {
  const session = await requireRolePage(["ADMIN", "SOCIO", "VENDEDOR", "STOCK"])
  const tenantId = await resolveSessionTenantId(session.user.tenantId)
  const canSeeFinancials = canSeeDatabaseFinancials(session.user.activeRole)

  const orders = await prisma.serviceOrder.findMany({
    where: tenantId ? { tenantId } : undefined,
    orderBy: { receivedAt: "desc" },
    include: {
      buyer: {
        select: {
          id: true,
          name: true,
          surname: true,
          phone: true,
        },
      },
      product: {
        select: {
          id: true,
          modelName: true,
        },
      },
      technician: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  })

  return (
    <DashboardLayout>
      <Breadcrumbs items={[{ label: "Inicio", href: "/" }, { label: "Servicio técnico" }]} />
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold">Órdenes de servicio</h2>
            <p className="text-sm text-base-content/70">Seguimiento de reparaciones, revisiones y entregas.</p>
          </div>
          <Link href="/dashboard/service-orders/new" className="btn btn-primary">
            Nueva orden
          </Link>
        </div>

        <SearchBar />

        <div className="overflow-x-auto rounded-box border border-base-content/5 bg-base-100">
          <table className="table table-zebra w-full">
            <thead>
              <tr>
                <th>Equipo / cliente</th>
                <th>Falla</th>
                <th>Producto</th>
                <th>Fecha</th>
                <th>Estado</th>
                {canSeeFinancials ? <th>Precio</th> : null}
                {canSeeFinancials ? <th>Costo</th> : null}
                <th>Técnico</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => {
                const buyerName = [order.buyer?.name, order.buyer?.surname].filter(Boolean).join(" ") || "Sin cliente"

                return (
                  <tr key={order.id}>
                    <td>
                      <div className="font-semibold">{order.modelName}</div>
                      <div className="text-xs text-base-content/60">{buyerName}</div>
                    </td>
                    <td className="max-w-xs">{order.failureDescription}</td>
                    <td>{order.product?.modelName ?? "-"}</td>
                    <td>{formatInTimeZone(order.receivedAt, AR_TIME_ZONE, "dd/MM/yyyy")}</td>
                    <td>
                      <span className={`badge ${statusClasses[order.status] ?? "badge-ghost"}`}>{statusLabels[order.status] ?? order.status}</span>
                    </td>
                    {canSeeFinancials ? <td>{order.priceAmount ? Number(order.priceAmount).toFixed(2) : "-"}</td> : null}
                    {canSeeFinancials ? <td>{order.costAmount ? Number(order.costAmount).toFixed(2) : "-"}</td> : null}
                    <td>{order.technician?.name ?? order.technician?.email ?? "-"}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </DashboardLayout>
  )
}
