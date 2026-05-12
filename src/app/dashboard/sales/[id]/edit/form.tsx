// app/sales/[id]/edit/form.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import DashboardLayout from "@/components/DashboardLayout";
import Breadcrumbs from "@/components/Breadcrumbs";
import type {
  Buyer,
  Product,
  SaleItemKind,
  PaymentMethod,
  Currency,
  SaleStatus,
} from "@prisma/client";
import type { Role } from "@/lib/auth/roles";

import BuyerSection from "@/components/sales/BuyerSection";
import SaleMetaSection from "@/components/sales/SaleMetaSection";
import SaleItemsSection from "@/components/sales/SaleItemsSection";
import PaymentsSection from "@/components/sales/PaymentsSection";
import TotalsBar from "@/components/sales/TotalsBar";
import SubmitBar from "@/components/sales/SubmitBar";

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

interface EditSaleFormProps {
  id: string;
}

async function readApiError(res: Response) {
  const contentType = res.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    const data = await res.json().catch(() => null);

    if (data?.error) {
      return String(data.error);
    }

    if (data?.message) {
      return String(data.message);
    }

    return JSON.stringify(data);
  }

  const text = await res.text().catch(() => "");
  return text || "Error inesperado.";
}

function getStatusBadgeClass(status: SaleStatus) {
  if (status === "SENADA") return "badge-warning";
  if (status === "CONFIRMADA") return "badge-success";
  if (status === "CANCELADA") return "badge-error";
  return "badge-neutral";
}

function parseResponseBody(text: string, contentType: string) {
  if (!text) return null;
  if (!contentType.includes("application/json")) return text;

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function responseErrorMessage(body: unknown) {
  if (body && typeof body === "object" && "error" in body) {
    return String((body as { error?: unknown }).error || "Error inesperado.");
  }

  if (body && typeof body === "object" && "message" in body) {
    return String((body as { message?: unknown }).message || "Error inesperado.");
  }

  return typeof body === "string" && body.trim() ? body : "Error inesperado.";
}

export default function EditSaleForm({ id }: EditSaleFormProps) {
  const router = useRouter();
  const { data: session } = useSession();

  const activeRole = (session?.user as { activeRole?: Role } | undefined)?.activeRole;

  const [selectedBuyer, setSelectedBuyer] = useState<Buyer | null>(null);
  const [meta, setMeta] = useState<SaleMeta>({
    date: new Date(),
    origin: "Instagram",
  });
  const [items, setItems] = useState<SaleItemDraft[]>([]);
  const [payments, setPayments] = useState<PaymentDraft[]>([]);
  const [saleStatus, setSaleStatus] = useState<SaleStatus>("CONFIRMADA");

  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  const saleIsLocked = saleStatus === "CONFIRMADA" && activeRole !== "ADMIN";
  const canChangeStatus = activeRole === "ADMIN" || saleStatus === "SENADA";

  const totals = useMemo(() => {
    const subtotal = items
      .filter((it) => it.kind === "NORMAL")
      .reduce((acc, it) => {
        const unitPrice = parseFloat(it.unitPrice || "0") || 0;
        return acc + unitPrice * it.units;
      }, 0);

    const extraCosts = items
      .filter((it) => it.kind === "IN_TOTAL")
      .reduce((acc, it) => {
        const unitCost = parseFloat(it.unitCost || "0") || 0;
        const extraCost = parseFloat(it.extraCost || "0") || 0;
        return acc + (unitCost + extraCost) * it.units;
      }, 0);

    const total = subtotal + extraCosts;

    const totalPaid = payments.reduce((acc, p) => {
      const amount = parseFloat(p.amount || "0") || 0;
      return acc + amount;
    }, 0);

    return {
      subtotal: subtotal.toFixed(2),
      extraCosts: extraCosts.toFixed(2),
      total: total.toFixed(2),
      totalPaid: totalPaid.toFixed(2),
      remaining: (total - totalPaid).toFixed(2),
    };
  }, [items, payments]);

  useEffect(() => {
    let mounted = true;

    async function loadSale() {
      setLoading(true);
      setError(null);

      try {
        const res = await fetch(`/api/sales/${id}`, {
          cache: "no-store",
        });

        if (!res.ok) {
          throw new Error(await readApiError(res));
        }

        const data = await res.json();
        const sale = data.sale;

        if (!sale) {
          throw new Error("No se encontró la venta.");
        }

        if (!mounted) return;

        setSaleStatus(sale.status ?? "CONFIRMADA");

        const buyer: Buyer | null = sale.buyer ?? null;
        setSelectedBuyer(buyer);

        const date = sale.date ? new Date(sale.date) : new Date();
        const origin = sale.origin ?? "Instagram";
        const notes = sale.notes ?? undefined;

        setMeta({
          date,
          origin,
          notes,
        });

        const itemDrafts: SaleItemDraft[] = Array.isArray(sale.items)
          ? sale.items.map((it: any) => ({
              productId: String(it.productId),
              product: it.product,
              units: Number(it.units || 1),
              unitPrice: it.unitPrice != null ? String(it.unitPrice) : "0",
              unitCost: it.unitCost != null ? String(it.unitCost) : "0",
              extraCost: it.extraCost != null ? String(it.extraCost) : "0",
              kind: it.kind as SaleItemKind,
              _id: String(it.id ?? `${it.productId}-${crypto.randomUUID()}`),
            }))
          : [];

        setItems(itemDrafts);

        const paymentDrafts: PaymentDraft[] = Array.isArray(sale.payments)
          ? sale.payments.map((p: any) => ({
              method: p.method as PaymentMethod,
              currency: p.currency as Currency,
              amount: p.amount != null ? String(p.amount) : "0",
              note: p.note ?? undefined,
              paidAt: p.paidAt ? new Date(p.paidAt) : undefined,
              _id: String(p.id ?? crypto.randomUUID()),
            }))
          : [];

        setPayments(paymentDrafts);
      } catch (e: unknown) {
        const error = e as Error;

        if (mounted) {
          setError(error?.message || "Error cargando la venta.");
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    loadSale();

    return () => {
      mounted = false;
    };
  }, [id]);

  const handleSubmit = async () => {
    if (saleIsLocked) {
      setError("La venta confirmada solo puede modificarse con rol activo ADMIN.");
      return;
    }

    if (items.length === 0 && saleStatus !== "CANCELADA") {
      setError("La venta debe tener al menos un producto.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const originToSend =
        meta.origin === "Otro" ? meta.customOrigin?.trim() : meta.origin?.trim();

      const payload = {
        buyerId: selectedBuyer?.id ?? null,
        date: meta.date instanceof Date ? meta.date.toISOString() : new Date(meta.date).toISOString(),
        origin: originToSend || null,
        notes: meta.notes?.trim() || null,
        status: saleStatus,
        items: items.map((it) => ({
          productId: it.productId,
          units: Number(it.units || 1),
          unitPrice: it.unitPrice || "0",
          unitCost: it.unitCost || "0",
          extraCost: it.extraCost || "0",
          kind: it.kind,
        })),
        payments: payments.map((p) => ({
          method: p.method,
          currency: p.currency,
          amount: p.amount || "0",
          note: p.note?.trim() || null,
          paidAt: p.paidAt ? p.paidAt.toISOString() : undefined,
        })),
      };

      const res = await fetch(`/api/sales/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const responseText = await res.text();
      const responseBody = parseResponseBody(
        responseText,
        res.headers.get("content-type") || "",
      );

      if (!res.ok) {
        throw new Error(responseErrorMessage(responseBody));
      }

      router.refresh();
      router.push("/dashboard/sales");
    } catch (e: unknown) {
      const error = e as Error;
      setError(error?.message || "No se pudo guardar la venta.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="p-6">Cargando venta…</div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <Breadcrumbs
        items={[
          { label: "Inicio", href: "/" },
          { label: "Ventas", href: "/dashboard/sales" },
          { label: "Editar Venta" },
        ]}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 p-4">
        <div className="lg:col-span-2 flex flex-col gap-6">
          <BuyerSection
            selectedBuyer={selectedBuyer}
            setSelectedBuyer={setSelectedBuyer}
            disabled={saleIsLocked}
          />

          <SaleMetaSection
            meta={meta}
            setMeta={setMeta}
            disabled={saleIsLocked}
          />

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
            <div className="card bg-base-100 border border-base-content/20 p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm text-base-content/70">Estado</span>

                <span className={`badge ${getStatusBadgeClass(saleStatus)}`}>
                  {saleStatus}
                </span>
              </div>

              <div className="divider my-2" />

              <label className="form-control w-full">
                <div className="label">
                  <span className="label-text">Cambiar estado</span>
                </div>

                <select
                  className="select select-bordered w-full"
                  value={saleStatus}
                  disabled={!canChangeStatus || saleIsLocked || isSubmitting}
                  onChange={(e) => setSaleStatus(e.target.value as SaleStatus)}
                >
                  <option value="SENADA">SENADA</option>
                  <option value="CONFIRMADA">CONFIRMADA</option>
                  {activeRole === "ADMIN" && (
                    <option value="CANCELADA">CANCELADA</option>
                  )}
                </select>

                {saleStatus === "SENADA" && (
                  <div className="label">
                    <span className="label-text-alt text-warning">
                      Al guardar como CONFIRMADA se descuenta stock y se actualizan los estados de productos.
                    </span>
                  </div>
                )}

                {saleIsLocked && (
                  <div className="label">
                    <span className="label-text-alt text-error">
                      Esta venta confirmada solo puede editarla un ADMIN.
                    </span>
                  </div>
                )}
              </label>

              <div className="divider my-2" />

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <div className="text-base-content/60">Subtotal</div>
                  <div className="font-mono font-semibold">$ {totals.subtotal}</div>
                </div>

                <div>
                  <div className="text-base-content/60">Extras</div>
                  <div className="font-mono font-semibold">$ {totals.extraCosts}</div>
                </div>

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
              submitLabel={
                saleStatus === "CONFIRMADA" ? "Guardar y confirmar" : "Guardar cambios"
              }
              submittingLabel="Guardando cambios..."
            />
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
