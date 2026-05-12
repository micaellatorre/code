// app/sales/[id]/edit/form.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import DashboardLayout from "@/components/DashboardLayout";
import Breadcrumbs from "@/components/Breadcrumbs";
import type { Buyer, Product, SaleItemKind, PaymentMethod, Currency, SaleStatus } from "@prisma/client";
import type { Role } from "@/lib/auth/roles";

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

import BuyerSection from "@/components/sales/BuyerSection";
import SaleMetaSection from "@/components/sales/SaleMetaSection";
import SaleItemsSection from "@/components/sales/SaleItemsSection";
import PaymentsSection from "@/components/sales/PaymentsSection";
import TotalsBar from "@/components/sales/TotalsBar";
import SubmitBar from "@/components/sales/SubmitBar";

interface EditSaleFormProps {
  id: string
}

export default function EditSaleForm({ id }: EditSaleFormProps) {
  const router = useRouter();
  const { data: session } = useSession();
  const activeRole = (session?.user as { activeRole?: Role } | undefined)?.activeRole;

  const [selectedBuyer, setSelectedBuyer] = useState<Buyer | null>(null);
  const [meta, setMeta] = useState<SaleMeta>({ date: new Date(), origin: "Instagram" });
  const [items, setItems] = useState<SaleItemDraft[]>([]);
  const [payments, setPayments] = useState<PaymentDraft[]>([]);
  const [saleStatus, setSaleStatus] = useState<SaleStatus>("CONFIRMADA");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const saleIsLocked = saleStatus === "CONFIRMADA" && activeRole !== "ADMIN";

  const totals = useMemo(() => {
    const subtotal = items
      .filter((it) => it.kind === "NORMAL")
      .reduce((acc, it) => acc + (parseFloat(it.unitPrice || "0") || 0) * it.units, 0);

    const extraCosts = items
      .filter((it) => it.kind === "IN_TOTAL")
      .reduce(
        (acc, it) =>
          acc +
          ((parseFloat(it.unitCost || "0") || 0) + (parseFloat(it.extraCost || "0") || 0)) *
            it.units,
        0
      );

    const total = subtotal + extraCosts;
    const totalPaid = payments.reduce((acc, p) => acc + (parseFloat(p.amount || "0") || 0), 0);

    return {
      total: total.toFixed(2),
      totalPaid: totalPaid.toFixed(2),
      remaining: (total - totalPaid).toFixed(2),
    };
  }, [items, payments]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/sales/${id}`, { cache: "no-store" });
        if (!res.ok) {
          const m = await res.text();
          throw new Error(m || "No se pudo cargar la venta.");
        }
        const data = await res.json();

        const sale = data.sale;
        if (mounted) setSaleStatus(sale?.status ?? "CONFIRMADA");

        const buyer: Buyer | null = sale?.buyer ?? null;
        if (mounted) setSelectedBuyer(buyer);

        const date = sale?.date ? new Date(sale.date) : new Date();
        const origin = sale?.origin ?? "Instagram";
        const notes = sale?.notes ?? undefined;
        if (mounted) setMeta({ date, origin, notes });

        const itemDrafts: SaleItemDraft[] = Array.isArray(sale?.items)
          ? sale.items.map((it: any) => ({
              productId: it.productId,
              product: it.product,
              units: it.units,
              unitPrice: String(it.unitPrice),
              unitCost: String(it.unitCost),
              extraCost: String(it.extraCost),
              kind: it.kind,
              _id: it.id,
            }))
          : [];
        if (mounted) setItems(itemDrafts);

        const paymentDrafts: PaymentDraft[] = Array.isArray(sale?.payments)
          ? sale.payments.map((p: any) => ({
              method: p.method,
              currency: p.currency,
              amount: String(p.amount),
              note: p.note ?? undefined,
              paidAt: p.paidAt ? new Date(p.paidAt) : undefined,
              _id: p.id,
            }))
          : [];
        if (mounted) setPayments(paymentDrafts);
      } catch (e: any) {
        if (mounted) setError(e?.message || "Error cargando la venta.");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [id]);

  const handleSubmit = async () => {
    if (saleIsLocked) {
      setError("La venta confirmada solo puede modificarse con rol activo ADMIN.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const r1 = await fetch(`/api/sales/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ buyerId: selectedBuyer?.id ?? null }),
      });
      if (!r1.ok) throw new Error(await r1.text());

      const r2 = await fetch(`/api/sales/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: meta.date.toISOString() }),
      });
      if (!r2.ok) throw new Error(await r2.text());

      const originToSend = meta.origin === "Otro" ? meta.customOrigin : meta.origin;
      const r3 = await fetch(`/api/sales/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ origin: originToSend ?? null, notes: meta.notes ?? null }),
      });
      if (!r3.ok) throw new Error(await r3.text());

      const rItems = await fetch(`/api/sales/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: items.map((it) => ({
            productId: it.productId,
            units: it.units,
            unitPrice: it.unitPrice,
            unitCost: it.unitCost,
            extraCost: it.extraCost,
            kind: it.kind,
          })),
        }),
      });
      if (!rItems.ok) throw new Error(await rItems.text());

      const r4 = await fetch(`/api/sales/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          payments: payments.map((p) => ({
            method: p.method,
            currency: p.currency,
            amount: p.amount,
            note: p.note,
            paidAt: p.paidAt?.toISOString(),
          })),
        }),
      });
      if (!r4.ok) throw new Error(await r4.text());

      router.push("/dashboard/sales");
    } catch (e: any) {
      setError(e?.message || "No se pudo guardar la venta.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout >
        <div className="p-6">Cargando venta…</div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout >
      <Breadcrumbs
        items={[
          { label: "Inicio", href: "/" },
          { label: "Ventas", href: "/dashboard/sales" },
          { label: "Editar Venta" },
        ]}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 p-4">
        <div className="lg:col-span-2 flex flex-col gap-6">
          <BuyerSection selectedBuyer={selectedBuyer} setSelectedBuyer={setSelectedBuyer} disabled={saleIsLocked} />
          <SaleMetaSection meta={meta} setMeta={setMeta} disabled={saleIsLocked} />
          <SaleItemsSection
            items={items}
            setItems={setItems}
            disabled={saleIsLocked}
          />
          <PaymentsSection
            payments={payments}
            setPayments={setPayments}
            total={totals.total}
            disabled={saleIsLocked}
          />
        </div>

        <div className="lg:col-span-1">
          <div className="sticky top-4 flex flex-col gap-6">
            <div className="card bg-base-100 border border-base-content/50 p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm text-base-content/70">Estado</span>
                <span className={`badge ${saleStatus === "SENADA" ? "badge-warning" : "badge-success"}`}>
                  {saleStatus}
                </span>
              </div>
              <div className="divider my-2"></div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <div className="text-base-content/60">Pagado</div>
                  <div className="font-mono font-semibold">$ {totals.totalPaid}</div>
                </div>
                <div>
                  <div className="text-base-content/60">Pendiente</div>
                  <div className="font-mono font-semibold">$ {totals.remaining}</div>
                </div>
              </div>
            </div>
            <TotalsBar items={items} payments={payments} />
            <SubmitBar
              disabled={isSubmitting || saleIsLocked}
              error={error}
              onSubmit={handleSubmit}
              isSubmitting={isSubmitting}
              submitLabel="Guardar cambios"
              submittingLabel="Guardando cambios..."
            />
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
