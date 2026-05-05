import Link from "next/link"
import DashboardLayout from "@/components/DashboardLayout"
import Breadcrumbs from "@/components/Breadcrumbs"
import prisma from "@/lib/prisma"
import type { Metadata } from "next"
import FilterableAppointmentsTable from "@/components/appointments/FilterableAppointmentsTable"
import { requireRolePage } from "@/lib/auth/auth"

export const metadata: Metadata = {
  title: "Citas",
  description: "Listado y gestión de citas",
}

export const dynamic = "force-dynamic"

export default async function AppointmentsPage() {
  await requireRolePage(["ADMIN", "VENDEDOR"])

  const appointments = await prisma.appointment.findMany({
    orderBy: { scheduledAt: "desc" },
    include: {
      buyer: { select: { name: true, surname: true, phone: true, instagram: true, id: true } },
      interests: {
        include: {
          product: {
            select: {
              id: true,
              type: true,
              modelName: true,
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

  const serialized = appointments.map((a) => ({
    id: a.id,
    scheduledAt: a.scheduledAt.toISOString(),
    durationMinutes: a.durationMinutes,
    status: a.status,
    outcome: a.outcome,
    noSaleReason: a.noSaleReason,
    buyer: a.buyer
      ? {
          id: a.buyer.id,
          name: `${a.buyer.name} ${a.buyer.surname || ""}`.trim(),
          phone: a.buyer.phone,
          instagram: a.buyer.instagram,
        }
      : null,
    interests: a.interests.map((i) => ({
      id: i.id,
      productId: i.productId,
      priority: i.priority,
      notes: i.notes,
      product: {
        id: i.product.id,
        type: i.product.type,
        modelName: i.product.modelName,
      },
    })),
    resultNotes: a.resultNotes,
    createdBy: a.user?.name || a.user?.email || "-",
    createdByUser: a.user
      ? {
          id: a.user.id,
          name: a.user.name,
          email: a.user.email ?? "",
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
