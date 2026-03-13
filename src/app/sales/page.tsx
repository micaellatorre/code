// /sales/page.tsx
import Link from 'next/link'
import DashboardLayout from '@/components/DashboardLayout'
import Breadcrumbs from '@/components/Breadcrumbs'
import FilterableSalesTable from '@/components/FilterableSalesTable'
import prisma from '@/lib/prisma'
import type { Metadata } from 'next'

// SEO
export const metadata: Metadata = {
  title: 'Ventas',
  description: 'Listado y gestión de ventas realizadas',
}

// Fuerza render del lado del servidor y runtime Node (Prisma)
export const dynamic = 'force-dynamic'

// Helper de serialización (evita BigInt/Decimal en cliente)
function toStr(v: any) {
  return v == null ? null : String(v)
}

export default async function SalesPage() {
  // Trae solo lo necesario y con shape estable para el cliente
  const sales = await prisma.sale.findMany({
    orderBy: { date: 'desc' },
    take: 200,
    include: {
      buyer: { select: { name: true, surname: true } },
      payments: { select: { method: true }, orderBy: { paidAt: 'asc' } },
      items: {
        include: {
          product: {
            select: {
              modelName: true,
              type: true,          // <- clave para el Modelo
              capacityGB: true,    // <- heurística en el cliente
              imei: true,          // <- heurística en el cliente
              costPrice: true,
              salePrice: true,
              shippingCost: true,
            },
          },
        },
      },
    },
  })

  const serialized = sales.map((s) => ({
    id: s.id,
    tenantId: s.tenantId,
    date: s.date ? s.date.toISOString() : null,
    customerName: s.customerName,
    origin: s.origin,
    // por compat: primer método si existe, pero la UI nueva usa payments aparte
    payment: s.payments.length > 0 ? s.payments[0].method : null,
    notes: s.notes,
    subtotal: toStr(s.subtotal),
    extraCosts: toStr(s.extraCosts),
    total: toStr(s.total),
    profit: toStr(s.profit),
    costTotal: toStr(s.costTotal),
    createdAt: s.createdAt ? s.createdAt.toISOString() : null,
    buyer: s.buyer ? { name: s.buyer.name, surname: s.buyer.surname } : null,
    items: s.items.map((item) => ({
      id: item.id,
      saleId: item.saleId,
      productId: item.productId,
      units: item.units,
      kind: item.kind,
      parentItemId: item.parentItemId,
      unitPrice: toStr(item.unitPrice),
      unitCost: toStr(item.unitCost),
      extraCost: toStr(item.extraCost),
      lineTotal: toStr(item.lineTotal),
      lineCost: toStr(item.lineCost),
      lineProfit: toStr(item.lineProfit),
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
      product: {
        modelName: item.product.modelName,
        type: typeof item.product.type === 'string' ? item.product.type.toUpperCase() : item.product.type,
        capacityGB: item.product.capacityGB,
        imei: item.product.imei,
        costPrice: toStr(item.product.costPrice),
        salePrice: toStr(item.product.salePrice),
        shippingCost: item.product.shippingCost ? toStr(item.product.shippingCost) : null,
      },
    })),
  }))

  return (
    <DashboardLayout activeTab="sales">
      <Breadcrumbs items={[{ label: 'Inicio', href: '/' }, { label: 'Ventas' }]} />
      <div className="flex flex-col gap-4">
        <FilterableSalesTable initial={serialized} />
      </div>
    </DashboardLayout>
  )
}
