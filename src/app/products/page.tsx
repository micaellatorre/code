"use client";
import DashboardLayout from '@/components/DashboardLayout'
import Link from 'next/link'
import type { Metadata } from 'next'
import Breadcrumbs from '@/components/Breadcrumbs'
import FilterableProductsTable from '@/components/FilterableProductsTable'
import useSWR from 'swr';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function ProductsPage() {
  const swrResponse = useSWR('/api/products', fetcher, {
    revalidateOnFocus: true,
    revalidateOnReconnect: true,
    refreshInterval: 30000,
  });

  // Serialize Decimal and Date values into plain JS types so they can be
  // safely passed into Client Components.
  const serialized = swrResponse.data?.map((p: any) => ({
    ...p,
    imei: p.imei ?? '',
    costPrice: p.costPrice != null ? String(p.costPrice) : null,
    salePrice: p.salePrice != null ? String(p.salePrice) : null,
    shippingCost: p.shippingCost != null ? String(p.shippingCost) : null,
    purchaseDate: p.purchaseDate ? p.purchaseDate.toISOString() : null,
    createdAt: p.createdAt ? p.createdAt.toISOString() : null,
    updatedAt: p.updatedAt ? p.updatedAt.toISOString() : null,
    notes: p.notes ?? '',
    stockInitial: p.stockInitial ?? 0,
    stock: p.stock ?? 0,
    stockAvailable: p.stockAvailable ?? 0,
  }))

  const serializedSWRResponse = { ...swrResponse, data: serialized }

  return (
    <DashboardLayout activeTab="products">
      <Breadcrumbs items={[{ label: 'Inicio', href: '/' }, { label: 'Productos' }]} />
      <div className="flex flex-col gap-4 h-full">
        <FilterableProductsTable {...serializedSWRResponse} />
      </div>
    </DashboardLayout>
  )
}
