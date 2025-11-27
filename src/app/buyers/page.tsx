// /buyers/page.tsx
"use client";
import DashboardLayout from '@/components/DashboardLayout'
import Breadcrumbs from '@/components/Breadcrumbs'
import FilterableBuyersTable from '@/components/FilterableBuyersTable'
import useSWR from 'swr';
import type { Metadata } from 'next'

// SEO
// Since we are moving to client-side rendering, metadata should be handled differently if it needs dynamic data.
// For now, we'll keep it static.
// export const metadata: Metadata = {
//   title: 'Clientes',
//   description: 'Listado y gestión de clientes.',
// }

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function ClientsPage() {
  const swrResponse = useSWR('/api/buyers', fetcher, {
    revalidateOnFocus: true, // Auto-refresh on window focus
    revalidateOnReconnect: true, // Auto-refresh on reconnect
    refreshInterval: 30000, // Optional: refresh every 30 seconds
  });

  return (
    <DashboardLayout activeTab="buyers">
      <Breadcrumbs items={[{ label: 'Inicio', href: '/' }, { label: 'Clientes' }]} />
      <div className="flex flex-col gap-4">
        <FilterableBuyersTable {...swrResponse} />
      </div>
    </DashboardLayout>
  )
}
