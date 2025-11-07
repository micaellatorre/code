
"use client";

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import Breadcrumbs from '@/components/Breadcrumbs';
import { Buyer, Product, SaleItemKind, PaymentMethod, Currency } from '@prisma/client';

// --- TYPE DEFINITIONS ---
// These types will be used by the child components.

export type SaleItemDraft = {
  productId: string;
  product: Product; // Store the whole product for UI purposes
  units: number;
  unitPrice: string;
  unitCost: string;
  extraCost: string;
  kind: SaleItemKind;
  // UI-only fields
  _id: string; // for react keys
};

export type PaymentDraft = {
  method: PaymentMethod;
  currency: Currency;
  amount: string;
  note?: string;
  paidAt?: Date;
  // UI-only fields
  _id: string; // for react keys
};

export type SaleMeta = {
  date: Date;
  origin: string;
  customOrigin?: string;
  notes?: string;
};

// --- MOCK COMPONENTS (to be implemented) ---
// I will create these components in subsequent steps.

import BuyerSection from '@/components/sales/BuyerSection';

import SaleMetaSection from '@/components/sales/SaleMetaSection';

import SaleItemsSection from '@/components/sales/SaleItemsSection';

import PaymentsSection from '@/components/sales/PaymentsSection';

import TotalsBar from '@/components/sales/TotalsBar';

import SubmitBar from '@/components/sales/SubmitBar';


// --- MAIN PAGE COMPONENT ---

export default function NewSalePage() {
  const router = useRouter();
  
  // Main state for the entire sale form
  const [selectedBuyer, setSelectedBuyer] = useState<Buyer | null>(null);
  const [meta, setMeta] = useState<SaleMeta>({ date: new Date(), origin: 'Instagram' });
  const [items, setItems] = useState<SaleItemDraft[]>([]);
  const [payments, setPayments] = useState<PaymentDraft[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // TODO: Replace with big.js or similar for client-side calculations to avoid floating point issues.
  // For now, using standard numbers for UI and sending strings to backend.
  const totals = useMemo(() => {
    const subtotal = items
      .filter(it => it.kind === 'NORMAL')
      .reduce((acc, it) => acc + parseFloat(it.unitPrice) * it.units, 0);

    const extraCosts = items
      .filter(it => it.kind === 'IN_TOTAL')
      .reduce((acc, it) => acc + (parseFloat(it.unitCost) + parseFloat(it.extraCost)) * it.units, 0);

    const total = subtotal + extraCosts;

    const totalPaid = payments.reduce((acc, p) => acc + parseFloat(p.amount), 0);

    return {
        total: total.toFixed(2),
        remaining: (total - totalPaid).toFixed(2),
    }
  }, [items, payments]);

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setError(null);

    if (items.length === 0) {
        setError('Debe agregar al menos un producto a la venta.');
        setIsSubmitting(false);
        return;
    }

    if (totals.remaining !== '0.00') {
        setError(`El monto de los pagos no coincide con el total. Restan ${totals.remaining} USD.`);
        setIsSubmitting(false);
        return;
    }

    const payload = {
      date: meta.date.toISOString(),
      buyerId: selectedBuyer?.id,
      customerName: !selectedBuyer ? 'Consumidor Final' : null,
      origin: meta.origin === 'Otro' ? meta.customOrigin : meta.origin,
      notes: meta.notes,
      items: items.map(it => ({
        productId: it.productId,
        units: it.units,
        unitPrice: it.unitPrice,
        unitCost: it.unitCost,
        extraCost: it.extraCost,
        kind: it.kind,
      })),
      payments: payments.map(p => ({
        method: p.method,
        currency: p.currency,
        amount: p.amount,
        note: p.note,
        paidAt: p.paidAt?.toISOString(),
      })),
    };

    try {
      const res = await fetch('/api/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        // TODO: Show success toast
        router.push('/sales');
      } else {
        const errorData = await res.json();
        setError(errorData.error || 'Ocurrió un error al crear la venta.');
      }
    } catch (e: any) {
      setError('No se pudo conectar con el servidor.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <DashboardLayout activeTab="sales">
      <Breadcrumbs
        items={[
          { label: 'Inicio', href: '/' },
          { label: 'Ventas', href: '/sales' },
          { label: 'Nueva Venta' },
        ]}
      />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 p-4">
        
        {/* Left Column: Main Data Entry */}
        <div className="lg:col-span-2 flex flex-col gap-6">
            <BuyerSection selectedBuyer={selectedBuyer} setSelectedBuyer={setSelectedBuyer} />
            <SaleMetaSection meta={meta} setMeta={setMeta} />
            <SaleItemsSection items={items} setItems={setItems} />
            <PaymentsSection payments={payments} setPayments={setPayments} total={totals.total} />
        </div>

        {/* Right Column: Totals & Actions */}
        <div className="lg:col-span-1">
            <div className="sticky top-4 flex flex-col gap-6">
                <TotalsBar items={items} payments={payments} />
                <SubmitBar 
                    disabled={isSubmitting || totals.remaining !== '0.00' || items.length === 0}
                    error={error}
                    onSubmit={handleSubmit}
                    isSubmitting={isSubmitting}
                />
            </div>
        </div>

      </div>
    </DashboardLayout>
  );
}