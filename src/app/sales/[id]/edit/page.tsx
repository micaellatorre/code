// app/sales/[id]/edit/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import DashboardLayout from "@/components/DashboardLayout";
import Breadcrumbs from "@/components/Breadcrumbs";
import type { Buyer, Product, SaleItemKind, PaymentMethod, Currency } from "../../../../../prisma/generated/client";

// ===== Tipos compartidos con /sales/new =====
export type SaleItemDraft = {
  productId: string;
  product: Product;
  units: number;
  unitPrice: string;
  unitCost: string;
  extraCost: string;
  kind: SaleItemKind;
  _id: string; // key UI
};

export type PaymentDraft = {
  method: PaymentMethod;
  currency: Currency;
  amount: string;
  note?: string;
  paidAt?: Date;
  _id: string; // key UI
};

export type SaleMeta = {
  date: Date;
  origin: string;
  customOrigin?: string;
  notes?: string;
};

// ===== Secciones reutilizadas =====
import BuyerSection from "@/components/sales/BuyerSection";
import SaleMetaSection from "@/components/sales/SaleMetaSection";
import SaleItemsSection from "@/components/sales/SaleItemsSection";
import PaymentsSection from "@/components/sales/PaymentsSection";
import TotalsBar from "@/components/sales/TotalsBar";
import SubmitBar from "@/components/sales/SubmitBar";

// ===== Page =====
export default function EditSalePage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const saleId = params?.id as string;

  // Estado principal (mismo shape que en "new")
  const [selectedBuyer, setSelectedBuyer] = useState<Buyer | null>(null);
  const [meta, setMeta] = useState<SaleMeta>({ date: new Date(), origin: "Instagram" });
  const [items, setItems] = useState<SaleItemDraft[]>([]);
  const [payments, setPayments] = useState<PaymentDraft[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  // Cálculos UI (igual que en "new")
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
      remaining: (total - totalPaid).toFixed(2),
    };
  }, [items, payments]);

  // ===== Carga inicial =====
  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/sales/${saleId}`, { cache: "no-store" });
        if (!res.ok) {
          const m = await res.text();
          throw new Error(m || "No se pudo cargar la venta.");
        }
        const data = await res.json();

        const sale = data.sale;

        // Buyer
        const buyer: Buyer | null = sale?.buyer ?? null;
        if (mounted) setSelectedBuyer(buyer);

        // Meta
        const date = sale?.date ? new Date(sale.date) : new Date();
        const origin = sale?.origin ?? "Instagram";
        const notes = sale?.notes ?? undefined;
        if (mounted) setMeta({ date, origin, notes });

        // Items -> Drafts (sólo para UI; no se persisten aún vía PATCH)
        const itemDrafts: SaleItemDraft[] = Array.isArray(sale?.items)
          ? sale.items.map((it: any) => ({
              productId: it.productId,
              product: it.product,
              units: it.units,
              unitPrice: String(it.unitPrice),
              unitCost: String(it.unitCost),
              extraCost: String(it.extraCost),
              kind: it.kind,
              _id: it.id, // key
            }))
          : [];
        if (mounted) setItems(itemDrafts);

        // Payments -> Drafts (UI)
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
  }, [saleId]);

  // ===== Submit: usa PATCHs compatibles con tu /api/sales/[id] actual =====
  const handleSubmit = async () => {
    setIsSubmitting(true);
    setError(null);

    try {
      // 1) Buyer (upsert + sync customerName)
      if (selectedBuyer) {
        const buyerPayload = {
          buyer: { name: selectedBuyer.name ?? "", surname: selectedBuyer.surname ?? "" },
        };
        const r1 = await fetch(`/api/sales/${saleId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(buyerPayload),
        });
        if (!r1.ok) throw new Error(await r1.text());
      } else {
        // Si no hay buyer seleccionado, dejá que customerName se edite por inline o agrega un campo aparte.
        // Acá podrías setear customerName si quisieras:
        // await fetch(`/api/sales/${saleId}`, { method: 'PATCH', body: JSON.stringify({ customerName: 'Consumidor Final' }) })
      }

      // 2) Fecha
      const r2 = await fetch(`/api/sales/${saleId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: meta.date.toISOString() }),
      });
      if (!r2.ok) throw new Error(await r2.text());

      // 3) Origen/Notas (si origin es "Otro", usa customOrigin)
      const originToSend = meta.origin === "Otro" ? meta.customOrigin : meta.origin;
      const r3 = await fetch(`/api/sales/${saleId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ origin: originToSend ?? null, notes: meta.notes ?? null }),
      });
      if (!r3.ok) throw new Error(await r3.text());

      // ⚠️ Items y Payments:
      // Tu route PATCH actual no acepta arreglos; cuando lo extiendas, enviá:
      // { items: [...], payments: [...] } aquí en un único PATCH o en endpoints dedicados.

      // OK
      router.push("/sales");
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
          { label: "Ventas", href: "/sales" },
          { label: "Editar Venta" },
        ]}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 p-4">
        {/* Columna Izquierda */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          <BuyerSection selectedBuyer={selectedBuyer} setSelectedBuyer={setSelectedBuyer} />
          <SaleMetaSection meta={meta} setMeta={setMeta} />

          {/* EDITAR ITEMS/PAGOS (UI lista, envío pendiente de backend) */}
          <div className="alert alert-info text-sm">
            Para actualizar renglones y pagos desde esta pantalla, extendé el
            endpoint <code>/api/sales/[id]</code> para aceptar <code>items</code> y{" "}
            <code>payments</code>. Por ahora, se guardan solo comprador, fecha, origen y notas.
          </div>

          <SaleItemsSection items={items} setItems={setItems} />
          <PaymentsSection payments={payments} setPayments={setPayments} total={totals.total} />
        </div>

        {/* Columna Derecha */}
        <div className="lg:col-span-1">
          <div className="sticky top-4 flex flex-col gap-6">
            <TotalsBar items={items} payments={payments} />
            <SubmitBar
              // Para edición, no forzamos exactitud de pagos vs total, porque aún no persistimos payments aquí
              disabled={isSubmitting}
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
