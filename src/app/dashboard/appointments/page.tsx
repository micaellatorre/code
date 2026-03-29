
// /appointments/page.tsx
import Link from 'next/link';
import DashboardLayout from '@/components/DashboardLayout';
import Breadcrumbs from '@/components/Breadcrumbs';
import prisma from '@/lib/prisma';
import type { Metadata } from 'next';
import FilterableAppointmentsTable from '@/components/appointments/FilterableAppointmentsTable';
import { requireRolePageWithFallback } from '@/lib/auth/auth';

// SEO
export const metadata: Metadata = {
  title: 'Citas',
  description: 'Listado y gestión de citas',
}

export const dynamic = 'force-dynamic';

export default async function AppointmentsPage() {
  await requireRolePageWithFallback(['ADMIN', 'VENDEDOR'], '/dashboard/appointments')

  const appointments = await prisma.appointment.findMany({
    orderBy: { scheduledAt: 'desc' },
    include: {
      buyer: { select: { name: true, surname: true, phone: true, instagram: true } },
      interests: {
        include: {
          product: {
            select: {
              modelName: true,
            },
          },
        },
      },
    },
  });

  const serialized = appointments.map((a) => ({
    id: a.id,
    scheduledAt: a.scheduledAt.toISOString(),
    durationMinutes: a.durationMinutes,
    status: a.status,
    outcome: a.outcome,
    noSaleReason: a.noSaleReason,
    buyer: a.buyer ? {
        name: `${a.buyer.name} ${a.buyer.surname || ''}`.trim(),
        phone: a.buyer.phone,
        instagram: a.buyer.instagram,
    } : null,
    interests: a.interests.map(i => i.product.modelName).join(', '),
    resultNotes: a.resultNotes,
  }));

  return (
    <DashboardLayout >
      <Breadcrumbs items={[{ label: 'Inicio', href: '/' }, { label: 'Citas' }]} />
      <div className="flex justify-end mb-4">
        <Link href="/appointments/new" className="btn btn-primary">
          + Nueva Cita
        </Link>
      </div>
      <div className="flex flex-col gap-4">
        <FilterableAppointmentsTable initial={serialized} />
      </div>
    </DashboardLayout>
  )
}
