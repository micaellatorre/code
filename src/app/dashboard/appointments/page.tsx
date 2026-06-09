import DashboardLayout from "@/components/DashboardLayout"
import Breadcrumbs from "@/components/Breadcrumbs"
import prisma from "@/lib/prisma"
import type { Metadata } from "next"
import FilterableAppointmentsTable from "@/components/appointments/FilterableAppointmentsTable"
import { requireRolePage } from "@/lib/auth/auth"

export const metadata: Metadata = {
  title: "Citas",
  description: "Gestion de reservas y citas",
}

export const dynamic = "force-dynamic"

export default async function AppointmentsPage() {
  await requireRolePage(["ADMIN", "VENDEDOR"])

  const appointments = await prisma.appointment.findMany({
    orderBy: { scheduledAt: "desc" },
    include: {
      buyer: { select: { name: true, surname: true, phone: true, instagram: true, email: true, id: true } },
      interests: {
        include: {
          product: {
            select: {
              id: true,
              type: true,
              modelName: true,
              capacityGB: true,
              condition: true,
              batteryPct: true,
              color: true,
              imei: true,
              salePrice: true,
              state: true,
              senado: true,
              location: true,
              stock: true,
              stockAvailable: true,
            },
          },
        },
      },
      user: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  })

  const serialized = appointments.map((appointment) => ({
    id: appointment.id,
    scheduledAt: appointment.scheduledAt.toISOString(),
    durationMinutes: appointment.durationMinutes,
    status: appointment.status,
    outcome: appointment.outcome,
    noSaleReason: appointment.noSaleReason,
    noSaleReasonOther: appointment.noSaleReasonOther,
    saleId: appointment.saleId,
    buyer: appointment.buyer
      ? {
          id: appointment.buyer.id,
          name: `${appointment.buyer.name} ${appointment.buyer.surname || ""}`.trim(),
          phone: appointment.buyer.phone,
          instagram: appointment.buyer.instagram,
          email: appointment.buyer.email,
        }
      : null,
    interests: appointment.interests.map((interest) => ({
      id: interest.id,
      productId: interest.productId,
      priority: interest.priority,
      notes: interest.notes,
      product: {
        id: interest.product.id,
        type: interest.product.type,
        modelName: interest.product.modelName,
        capacityGB: interest.product.capacityGB,
        condition: interest.product.condition,
        batteryPct: interest.product.batteryPct,
        color: interest.product.color,
        imei: interest.product.imei,
        salePrice: Number(interest.product.salePrice ?? 0),
        state: interest.product.state,
        senado: interest.product.senado,
        location: interest.product.location,
        stock: interest.product.stock,
        stockAvailable: interest.product.stockAvailable,
      },
    })),
    resultNotes: appointment.resultNotes,
    createdBy: appointment.user?.name || appointment.user?.email || "-",
    createdByUser: appointment.user
      ? {
          id: appointment.user.id,
          name: appointment.user.name,
          email: appointment.user.email ?? "",
        }
      : null,
  }))

  return (
    <DashboardLayout>
      <Breadcrumbs items={[{ label: "Inicio", href: "/" }, { label: "Citas" }]} />
      <div className="flex flex-col gap-4">
        <FilterableAppointmentsTable initial={serialized} />
      </div>
    </DashboardLayout>
  )
}
