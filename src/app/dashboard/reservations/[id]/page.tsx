import Link from "next/link"
import Breadcrumbs from "@/components/Breadcrumbs"
import DashboardLayout from "@/components/DashboardLayout"
import ReservationDetailActions from "@/components/reservations/ReservationDetailActions"
import prisma from "@/lib/prisma"
import { requireRolePage } from "@/lib/auth/auth"
import { resolveSessionTenantId } from "@/lib/tenant"

type Props = { params: Promise<{ id: string }> }

function money(value: unknown) {
  return value == null ? "-" : `USD ${Number(value).toFixed(2)}`
}

export default async function ReservationDetailPage({ params }: Props) {
  const session = await requireRolePage(["ADMIN", "SOCIO", "VENDEDOR", "STOCK"])
  const tenantId = await resolveSessionTenantId(session.user.tenantId)
  if (!tenantId) throw new Error("Tenant no disponible")
  const { id } = await params
  const reservation = await prisma.reservation.findFirst({
    where: { id, tenantId },
    include: { buyer: true, items: { include: { product: true } }, payments: true, convertedSale: { select: { id: true } } },
  })
  if (!reservation) throw new Error("Reserva no encontrada")

  return (
    <DashboardLayout>
      <Breadcrumbs items={[{ label: "Inicio", href: "/" }, { label: "Guardados", href: "/dashboard/database?tab=reservations" }, { label: "Reserva" }]} />
      <div className="space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold">Reserva</h1>
            <p className="text-sm text-base-content/60">{reservation.buyer ? [reservation.buyer.name, reservation.buyer.surname].filter(Boolean).join(" ") : "Sin comprador"} · {reservation.status}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link className="btn btn-ghost btn-sm" href={`/dashboard/reservations/${reservation.id}/edit`}>Editar</Link>
            {reservation.convertedSale ? <Link className="btn btn-outline btn-sm" href={`/dashboard/sales/${reservation.convertedSale.id}/edit`}>Ver venta</Link> : null}
          </div>
        </div>
        <ReservationDetailActions id={reservation.id} status={reservation.status} />
        <div className="grid gap-4 lg:grid-cols-2">
          <section className="rounded-lg border border-base-300 p-4">
            <h2 className="font-semibold">Items</h2>
            <div className="mt-3 divide-y divide-base-300">
              {reservation.items.map((item) => (
                <div key={item.id} className="py-2">
                  <div className="font-medium">{item.itemName}</div>
                  <div className="text-sm text-base-content/60">{item.imeiSerial || item.product?.imei || "Sin IMEI"} · {money(item.unitPrice)}</div>
                </div>
              ))}
            </div>
          </section>
          <section className="rounded-lg border border-base-300 p-4">
            <h2 className="font-semibold">Pagos</h2>
            <div className="mt-3 divide-y divide-base-300">
              {reservation.payments.map((payment) => (
                <div key={payment.id} className="flex justify-between py-2 text-sm">
                  <span>{payment.method}</span>
                  <span className="tabular-nums">{payment.currency} {Number(payment.amount).toFixed(2)}</span>
                </div>
              ))}
              {!reservation.payments.length ? <div className="py-3 text-sm text-base-content/60">Sin pagos registrados.</div> : null}
            </div>
          </section>
        </div>
      </div>
    </DashboardLayout>
  )
}
