"use client";

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import Breadcrumbs from '@/components/Breadcrumbs';
import type { Buyer, Product, SaleItemKind, PaymentMethod, Currency } from '@prisma/client';

export type SaleItemDraft = {
  productId: string;
  product: Product;
  units: number;
  unitPrice: string;
  unitCost: string;
  extraCost: string;
  kind: SaleItemKind;
  _id: string;
};

export type PaymentDraft = {
  method: PaymentMethod;
  currency: Currency;
  amount: string;
  note?: string;
  paidAt?: Date;
  _id: string;
};

export type SaleMeta = {
  date: Date;
  origin: string;
  customOrigin?: string;
  notes?: string;
};

type SaleSubmitMode = 'CONFIRM_SALE' | 'RESERVE';

function toNumber(value: string | number | null | undefined) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

import BuyerSection from '@/components/sales/BuyerSection';
import SaleMetaSection from '@/components/sales/SaleMetaSection';
import SaleItemsSection from '@/components/sales/SaleItemsSection';
import PaymentsSection from '@/components/sales/PaymentsSection';
import TotalsBar from '@/components/sales/TotalsBar';
import SubmitBar from '@/components/sales/SubmitBar';

export default function NewSaleForm() {
  const router = useRouter();
  
  const [selectedBuyer, setSelectedBuyer] = useState<Buyer | null>(null);
  const [meta, setMeta] = useState<SaleMeta>({ date: new Date(), origin: 'Instagram' });
  const [items, setItems] = useState<SaleItemDraft[]>([]);
  const [payments, setPayments] = useState<PaymentDraft[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isReserving, setIsReserving] = useState(false);

  const totals = useMemo(() => {
    const subtotal = items
      .filter(it => it.kind === 'NORMAL')
      .reduce((acc, it) => acc + toNumber(it.unitPrice) * it.units, 0);

    const extraCosts = items
      .filter(it => it.kind === 'IN_TOTAL')
      .reduce((acc, it) => acc + (toNumber(it.unitCost) + toNumber(it.extraCost)) * it.units, 0);

    const total = subtotal + extraCosts;
    const totalPaid = payments.reduce((acc, p) => acc + toNumber(p.amount), 0);

    return {
        total,
        totalPaid,
        remaining: total - totalPaid,
        totalFormatted: total.toFixed(2),
        totalPaidFormatted: totalPaid.toFixed(2),
        remainingFormatted: (total - totalPaid).toFixed(2),
    }
  }, [items, payments]);

  const buildPayload = (mode: SaleSubmitMode) => ({
    operationType: mode,
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
  });

  const handleSubmit = async (mode: SaleSubmitMode) => {
    setError(null);

    if (items.length === 0) {
        setError('Debe agregar al menos un producto a la operación.');
        return;
    }

    if (mode === 'CONFIRM_SALE' && totals.remainingFormatted !== '0.00') {
        setError(`El monto de los pagos no coincide con el total. Restan ${totals.remainingFormatted} USD.`);
        return;
    }

    if (mode === 'RESERVE') {
      if (payments.length === 0 || totals.totalPaid <= 0) {
        setError('Para señar, debe registrar al menos un pago mayor a 0.');
        return;
      }

      if (totals.totalPaid > totals.total) {
        setError('La seña no puede superar el total de la venta.');
        return;
      }
    }

    if (mode === 'CONFIRM_SALE') setIsSubmitting(true);
    else setIsReserving(true);

    try {
      const res = await fetch('/api/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildPayload(mode)),
      });

      if (res.ok) {
        router.push('/dashboard/sales');
      } else {
        const errorData = await res.json();
        setError(errorData.error || 'Ocurrió un error al crear la venta.');
      }
    } catch (e: any) {
      setError('No se pudo conectar con el servidor.');
    } finally {
      setIsSubmitting(false);
      setIsReserving(false);
    }
  };

  const confirmSaleDisabled =
    isSubmitting ||
    isReserving ||
    totals.remainingFormatted !== '0.00' ||
    items.length === 0;

  const reserveDisabled =
    isSubmitting ||
    isReserving ||
    items.length === 0 ||
    payments.length === 0 ||
    totals.totalPaid <= 0 ||
    totals.totalPaid > totals.total;

  return (
    <DashboardLayout >
      <Breadcrumbs
        items={[
          { label: 'Inicio', href: '/' },
          { label: 'Ventas', href: '/dashboard/sales' },
          { label: 'Nueva Venta' },
        ]}
      />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 p-4">
        <div className="lg:col-span-2 flex flex-col gap-4">
            <BuyerSection selectedBuyer={selectedBuyer} setSelectedBuyer={setSelectedBuyer} />
            <SaleMetaSection meta={meta} setMeta={setMeta} />
            <SaleItemsSection items={items} setItems={setItems} />
            <PaymentsSection payments={payments} setPayments={setPayments} total={totals.totalFormatted} />
        </div>

        <div className="lg:col-span-1">
            <div className="sticky top-4 flex flex-col gap-4">
                <TotalsBar items={items} payments={payments} />
                <SubmitBar 
                    disabled={confirmSaleDisabled}
                    reserveDisabled={reserveDisabled}
                    error={error}
                    onSubmit={() => handleSubmit('CONFIRM_SALE')}
                    onReserve={() => handleSubmit('RESERVE')}
                    isSubmitting={isSubmitting}
                    isReserving={isReserving}
                />
            </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
