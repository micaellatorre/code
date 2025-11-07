"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import SearchBar from "@/components/SearchBar";

// ====== Tipos ======
type SerializedSale = {
  id: string;
  tenantId: string;
  date: string | null;
  customerName: string | null;
  origin: string | null;
  payment: string | null;
  notes: string | null;
  items?: any[];
  subtotal: string | null;
  extraCosts: string | null;
  total: string | null;
  profit: string | null;
  costTotal: string | null;
  createdAt: string | null;
  buyer: {
    name: string;
    surname: string | null;
  } | null;
};

// ====== Utils ======
const toStr = (v: any) => (v == null ? null : String(v));

// Normaliza tanto root como items para mantener shape estable
function normalizeSales(input: any[]): SerializedSale[] {
  return (Array.isArray(input) ? input : []).map((s) => ({
    ...s,
    date: s?.date ?? null,
    subtotal: toStr(s?.subtotal),
    extraCosts: toStr(s?.extraCosts),
    total: toStr(s?.total),
    profit: toStr(s?.profit),
    costTotal: toStr(s?.costTotal),
    createdAt: s?.createdAt ?? null,
    items: Array.isArray(s?.items)
      ? s.items.map((it: any) => {
        const p = it?.product ?? {};
        const type =
          typeof p?.type === "string" ? p.type.toUpperCase() : p.type;
        return {
          ...it,
          unitPrice: toStr(it?.unitPrice),
          unitCost: toStr(it?.unitCost),
          extraCost: toStr(it?.extraCost),
          lineTotal: toStr(it?.lineTotal),
          lineCost: toStr(it?.lineCost),
          lineProfit: toStr(it?.lineProfit),
          product: {
            ...p,
            type,
            modelName: p?.modelName ?? "-",
            capacityGB: p?.capacityGB ?? null,
            imei: p?.imei ?? null,
          },
        };
      })
      : [],
  }));
}

// Modelo principal (para la columna “Modelo”)
const getMainModel = (items: any[] | undefined) => {
  if (!Array.isArray(items) || items.length === 0) return "-";
  const phoneByType = items.find(
    (i) => String(i?.product?.type ?? "").toUpperCase() === "PHONE"
  );
  if (phoneByType?.product?.modelName) return phoneByType.product.modelName;

  const phoneByHeuristic = items.find(
    (i) =>
      i?.product && (i.product.capacityGB != null || i.product.imei != null)
  );
  if (phoneByHeuristic?.product?.modelName)
    return phoneByHeuristic.product.modelName;

  return items[0]?.product?.modelName ?? "-";
};

// ====== Componente ======
export default function FilterableSalesTable({ initial }: { initial: SerializedSale[] }) {
  // Normaliza SSR inicial
  const [items, setItems] = useState<SerializedSale[]>(() =>
    normalizeSales(initial)
  );

  // Búsqueda + debounce
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(searchQuery.trim()), 300);
    return () => clearTimeout(t);
  }, [searchQuery]);

  // Estados UI
  const [loading, setLoading] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [isTableExpanded, setIsTableExpanded] = useState(false);

  // Filtros
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [minTotal, setMinTotal] = useState<string>("");
  const [maxTotal, setMaxTotal] = useState<string>("");
  const [minProfit, setMinProfit] = useState<string>("");
  const [maxProfit, setMaxProfit] = useState<string>("");

  // Inline edit por campo (mismo patrón que Products)
  const [editingFields, setEditingFields] = useState<
    Record<string, Record<string, string>>
  >({});
  const [savingField, setSavingField] = useState<{
    saleId: string;
    fieldName: string;
  } | null>(null);

  // Delete
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Abort de fetch para evitar race
  const abortRef = useRef<AbortController | null>(null);
  const ctrlAbort = (ref: React.MutableRefObject<AbortController | null>) => {
    if (ref.current) {
      ref.current.abort();
      ref.current = null;
    }
  };

  // Fetch cuando cambia la búsqueda (si hay endpoint de search)
  useEffect(() => {
    let mounted = true;

    const doFetch = async () => {
      setLoading(true);
      // abort anterior
      if (abortRef.current) {
        abortRef.current.abort();
      }
      const ctrl = new AbortController();
      abortRef.current = ctrl;

      try {
        if (debouncedQuery) {
          const url = new URL("/api/sales/search", location.origin);
          url.searchParams.set("q", debouncedQuery);
          const r = await fetch(url.toString(), {
            cache: "no-store",
            signal: ctrl.signal,
          });
          if (!r.ok) throw new Error(await r.text());
          const body = await r.json();
          if (mounted) setItems(normalizeSales(body?.results ?? []));
        } else {
          // Sin query: mostrar SSR inicial normalizado
          if (mounted) setItems(normalizeSales(initial));
        }
      } catch (e: any) {
        if (e?.name !== "AbortError") {
          console.error("search fetch failed:", e);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    doFetch();
    return () => {
      mounted = false;
      ctrlAbort(abortRef);
    };
  }, [debouncedQuery, initial]);

  // Formato fecha AR (solo fecha)
  const formatArgentina = (iso: string | null) => {
    if (!iso) return "-";
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "-";
    try {
      return d.toLocaleString("es-AR", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      });
    } catch {
      const y = d.getUTCFullYear();
      const m = String(d.getUTCMonth() + 1).padStart(2, "0");
      const day = String(d.getUTCDate()).padStart(2, "0");
      return `${day}/${m}/${y}`;
    }
  };

  // Filtro cliente (sobre items ya traídos — incluye búsqueda textual secundaria)
  const displayed = useMemo(() => {
    const q = debouncedQuery.toLowerCase();

    return items.filter((s) => {
      // Texto: id, customerName, buyer name/surname, modelos
      if (q) {
        const hayTexto =
          (s.id ?? "").toLowerCase().includes(q) ||
          (s.customerName ?? "").toLowerCase().includes(q) ||
          (s.buyer?.name ?? "").toLowerCase().includes(q) ||
          (s.buyer?.surname ?? "").toLowerCase().includes(q) ||
          (Array.isArray(s.items) &&
            s.items.some((it) =>
              String(it?.product?.modelName ?? "").toLowerCase().includes(q)
            ));
        if (!hayTexto) return false;
      }

      // Rango fechas
      if (startDate || endDate) {
        if (!s.date) return false;
        const t = new Date(s.date).getTime();
        if (startDate) {
          const sd = new Date(`${startDate}T00:00:00Z`).getTime();
          if (t < sd) return false;
        }
        if (endDate) {
          const ed = new Date(`${endDate}T23:59:59.999Z`).getTime();
          if (t > ed) return false;
        }
      }

      // Rangos numéricos
      if (minTotal) {
        const v = s.total ? parseFloat(s.total) : NaN;
        if (!Number.isFinite(v) || v < parseFloat(minTotal)) return false;
      }
      if (maxTotal) {
        const v = s.total ? parseFloat(s.total) : NaN;
        if (!Number.isFinite(v) || v > parseFloat(maxTotal)) return false;
      }
      if (minProfit) {
        const v = s.profit ? parseFloat(s.profit) : NaN;
        if (!Number.isFinite(v) || v < parseFloat(minProfit)) return false;
      }
      if (maxProfit) {
        const v = s.profit ? parseFloat(s.profit) : NaN;
        if (!Number.isFinite(v) || v > parseFloat(maxProfit)) return false;
      }

      return true;
    });
  }, [items, debouncedQuery, startDate, endDate, minTotal, maxTotal, minProfit, maxProfit]);

  // ====== Inline Edit (patrón Products) ======
  const isEditing = (saleId: string, fieldName: string) =>
    editingFields[saleId]?.[fieldName] !== undefined;

  const getEditingValue = (saleId: string, fieldName: string) =>
    editingFields[saleId]?.[fieldName] ?? "";

  const startEditField = (saleId: string, fieldName: string, currentValue: any) => {
    setEditingFields((prev) => ({
      ...prev,
      [saleId]: {
        ...prev[saleId],
        [fieldName]: currentValue == null ? "" : String(currentValue),
      },
    }));
  };

  const updateEditingValue = (saleId: string, fieldName: string, value: string) => {
    setEditingFields((prev) => ({
      ...prev,
      [saleId]: {
        ...prev[saleId],
        [fieldName]: value,
      },
    }));
  };

  const cancelEditField = (saleId: string, fieldName: string) => {
    setEditingFields((prev) => {
      const next = { ...prev };
      const saleMap = { ...(next[saleId] || {}) };
      delete saleMap[fieldName];
      if (Object.keys(saleMap).length === 0) delete next[saleId];
      else next[saleId] = saleMap;
      return next;
    });
  };

  // === NUEVO: persistFieldUpdate (estilo Products) ===
  async function persistFieldUpdate(saleId: string, fieldName: string, value: any) {
    setSavingField({ saleId, fieldName });
    try {
      // Caso especial: buyer.name / buyer.surname -> mandamos ambos juntos
      if (fieldName.startsWith("buyer.")) {
        const original = items.find((x) => x.id === saleId);
        const name =
          (editingFields[saleId]?.["buyer.name"] ??
            original?.buyer?.name ??
            "") || "";
        const surname =
          (editingFields[saleId]?.["buyer.surname"] ??
            original?.buyer?.surname ??
            "") || "";

        const res = await fetch(`/api/sales/${saleId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ buyer: { name: name.trim(), surname: surname.trim() } }),
        });
        if (!res.ok) throw new Error(await res.text());
        const body = await res.json();
        setItems((prev) =>
          prev.map((s) => (s.id === saleId ? normalizeSales([body.sale])[0] ?? s : s))
        );

        // limpia ambos campos
        setEditingFields((prev) => {
          const copy = { ...prev };
          if (copy[saleId]) {
            const row = { ...copy[saleId] };
            delete row["buyer.name"];
            delete row["buyer.surname"];
            if (Object.keys(row).length) copy[saleId] = row;
            else delete copy[saleId];
          }
          return copy;
        });
        return;
      }

      const res = await fetch(`/api/sales/${saleId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [fieldName]: value }),
      });
      if (!res.ok) throw new Error(await res.text());
      const body = await res.json();
      setItems((prev) =>
        prev.map((s) => (s.id === saleId ? normalizeSales([body.sale])[0] ?? s : s))
      );

      // limpia estado de edición
      cancelEditField(saleId, fieldName);
    } catch (err) {
      console.error(`Failed to persist ${fieldName} update`, err);
      alert("No se pudo guardar. Se revirtieron los cambios.");
      // revertimos a initial (o a la última versión known-good si la tuvieras)
      setItems((_) => normalizeSales(initial));
    } finally {
      setSavingField(null);
    }
  }

  function commitEditField(saleId: string, fieldName: string) {
    const editingValue = editingFields[saleId]?.[fieldName];
    if (editingValue === undefined) return;

    const row = items.find((s) => s.id === saleId);
    if (!row) return;

    let processed: any =
      typeof editingValue === "string" ? editingValue.trim() : editingValue;
    if (processed === "") processed = null;

    // Tipos específicos
    if (["subtotal", "extraCosts", "total", "profit", "costTotal"].includes(fieldName)) {
      if (processed == null) {
        // permitimos null
      } else {
        const n = parseFloat(String(processed));
        if (!Number.isFinite(n)) return;
        processed = n;
      }
    } else if (fieldName === "date" && processed) {
      const d = new Date(processed);
      if (isNaN(d.getTime())) return;
      processed = d.toISOString();
    } else if (["customerName", "origin", "payment", "notes"].includes(fieldName)) {
      // strings: null si vacío
      processed = processed ?? null;
    }

    // Optimistic update del campo puntual
    setItems((prev) =>
      prev.map((s) => (s.id === saleId ? { ...s, [fieldName]: processed } : s))
    );

    // Persistir
    persistFieldUpdate(saleId, fieldName, processed);
  }

  // ====== Delete ======
  const deleteSale = async (id: string) => {
    if (!window.confirm("¿Está seguro que desea eliminar esta venta?")) return;
    setDeletingId(id);

    // snapshot para rollback
    const snapshot = items;
    setItems((prev) => prev.filter((s) => s.id !== id));

    try {
      const res = await fetch(`/api/sales/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(await res.text());
    } catch (err) {
      console.error("Delete failed", err);
      alert("No se pudo eliminar la venta. Revirtiendo cambios.");
      setItems(snapshot);
    } finally {
      setDeletingId(null);
    }
  };

  const originOptions = [
    "Instagram",
    "Facebook",
    "TikTok",
    "Conocido",
    "Whatsapp",
    "Mercado Libre",
    "Otro",
  ];

  // ====== Render ======
  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-between items-center">
        <div className="flex flex-row items-center justify-between gap-2">
          <h2 className="text-2xl font-bold">
            Ventas
            <span className="ml-4 text-sm text-base-content/60">
              - Resultados {displayed.length}
            </span>
            <span className="ml-1 text-sm text-base-content/30">de</span>
            <span className="ml-1 text-sm text-base-content/30">
              {items.length}
            </span>
          </h2>
          <button
            type="button"
            className="btn btn-ghost btn-sm btn-outline border border-base-content/10 h-[2.4em] flex items-center"
            onClick={() => setIsTableExpanded(!isTableExpanded)}
            title={isTableExpanded ? "Contraer tabla" : "Expandir tabla"}
          >
            {isTableExpanded ? 'Comprimir' : 'Expandir '} Tabla
            {isTableExpanded ? (
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="size-6">
                <path fillRule="evenodd" d="M3.22 3.22a.75.75 0 0 1 1.06 0l3.97 3.97V4.5a.75.75 0 0 1 1.5 0V9a.75.75 0 0 1-.75.75H4.5a.75.75 0 0 1 0-1.5h2.69L3.22 4.28a.75.75 0 0 1 0-1.06Zm17.56 0a.75.75 0 0 1 0 1.06l-3.97 3.97h2.69a.75.75 0 0 1 0 1.5H15a.75.75 0 0 1-.75-.75V4.5a.75.75 0 0 1 1.5 0v2.69l3.97-3.97a.75.75 0 0 1 1.06 0ZM3.75 15a.75.75 0 0 1 .75-.75H9a.75.75 0 0 1 .75.75v4.5a.75.75 0 0 1-1.5 0v-2.69l-3.97 3.97a.75.75 0 0 1-1.06-1.06l3.97-3.97H4.5a.75.75 0 0 1-.75-.75Zm10.5 0a.75.75 0 0 1 .75-.75h4.5a.75.75 0 0 1 0 1.5h-2.69l3.97 3.97a.75.75 0 1 1-1.06 1.06l-3.97-3.97v2.69a.75.75 0 0 1-1.5 0V15Z" clipRule="evenodd" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="size-6">
                <path fillRule="evenodd" d="M15 3.75a.75.75 0 0 1 .75-.75h4.5a.75.75 0 0 1 .75.75v4.5a.75.75 0 0 1-1.5 0V5.56l-3.97 3.97a.75.75 0 1 1-1.06-1.06l3.97-3.97h-2.69a.75.75 0 0 1-.75-.75Zm-12 0A.75.75 0 0 1 3.75 3h4.5a.75.75 0 0 1 0 1.5H5.56l3.97 3.97a.75.75 0 0 1-1.06 1.06L4.5 5.56v2.69a.75.75 0 0 1-1.5 0v-4.5Zm11.47 11.78a.75.75 0 1 1 1.06-1.06l3.97 3.97v-2.69a.75.75 0 0 1 1.5 0v4.5a.75.75 0 0 1-.75.75h-4.5a.75.75 0 0 1 0-1.5h2.69l-3.97-3.97Zm-4.94-1.06a.75.75 0 0 1 0 1.06L5.56 19.5h2.69a.75.75 0 0 1 0 1.5h-4.5a.75.75 0 0 1-.75-.75v-4.5a.75.75 0 0 1 1.5 0v2.69l3.97-3.97a.75.75 0 0 1 1.06 0Z" clipRule="evenodd" />
              </svg>
            )}
          </button>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/sales/new" className="btn btn-primary">
            Nueva Venta
          </Link>
        </div>
      </div>

      {/* Header: búsqueda, filtros */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 w-full">
          <SearchBar
            placeholder="Buscar ventas por cliente, id o modelo..."
            onSearch={setSearchQuery}
          />
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={() => setDrawerOpen(true)}
            title="Abrir filtros"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="w-5 h-5 mr-1"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth="1.5"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3 6h18M6 12h12m-8 6h4"
              />
            </svg>
            Filtros
          </button>
        </div>
      </div>

      {/* Drawer de filtros */}
      {drawerOpen && (
        <div className="fixed inset-0 z-[100] pointer-events-none">
          <label
            htmlFor="filters-drawer"
            className="fixed inset-0 bg-black/50 cursor-pointer pointer-events-auto backdrop-blur-[0.1em]"
            onClick={() => setDrawerOpen(false)}
          />
          <div className="fixed right-0 top-0 h-full w-80 bg-base-200 text-base-content shadow-xl pointer-events-auto overflow-y-auto">
            <div className="menu p-4 min-h-full">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold">Filtros</h3>
                <button
                  type="button"
                  className="btn btn-sm btn-circle btn-ghost"
                  onClick={() => setDrawerOpen(false)}
                >
                  ✕
                </button>
              </div>

              <div className="flex flex-col gap-4">
                <div className="form-control">
                  <label className="label">
                    <span className="label-text">Desde (fecha)</span>
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="input input-bordered"
                  />
                </div>
                <div className="form-control">
                  <label className="label">
                    <span className="label-text">Hasta (fecha)</span>
                  </label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="input input-bordered"
                  />
                </div>
                <div className="form-control">
                  <label className="label">
                    <span className="label-text">Total Min</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={minTotal}
                    onChange={(e) => setMinTotal(e.target.value)}
                    className="input input-bordered"
                  />
                </div>
                <div className="form-control">
                  <label className="label">
                    <span className="label-text">Total Max</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={maxTotal}
                    onChange={(e) => setMaxTotal(e.target.value)}
                    className="input input-bordered"
                  />
                </div>
                <div className="form-control">
                  <label className="label">
                    <span className="label-text">Gcia. Min</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={minProfit}
                    onChange={(e) => setMinProfit(e.target.value)}
                    className="input input-bordered"
                  />
                </div>
                <div className="form-control">
                  <label className="label">
                    <span className="label-text">Gcia. Max</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={maxProfit}
                    onChange={(e) => setMaxProfit(e.target.value)}
                    className="input input-bordered"
                  />
                </div>

                <div className="divider" />

                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => {
                    setStartDate("");
                    setEndDate("");
                    setMinTotal("");
                    setMaxTotal("");
                    setMinProfit("");
                    setMaxProfit("");
                    setSearchQuery("");
                    setDrawerOpen(false);
                  }}
                >
                  Limpiar filtros
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* switch oculto para controlled drawer */}
      <input
        id="filters-drawer"
        type="checkbox"
        className="hidden"
        checked={drawerOpen}
        onChange={(e) => setDrawerOpen(e.target.checked)}
      />

      {/* Tabla */}
      <div className="relative overflow-x-auto rounded-box border border-base-content/5 bg-base-100 h-[70dvh]">
        {loading && (
          <div className="absolute inset-0 bg-base-100/70 backdrop-blur-[1px] z-10 flex items-center justify-center text-sm text-base-content/60">
            Buscando…
          </div>
        )}

        {displayed.length === 0 ? (
          <div className="p-8 text-center text-base-content/60">
            {debouncedQuery || startDate || endDate || minTotal || maxTotal || minProfit || maxProfit
              ? "No hay resultados con los filtros aplicados."
              : "Aún no hay ventas para mostrar."}
          </div>
        ) : (
          <table
            className={`table table-zebra w-full table-pin-rows table-pin-cols ${isTableExpanded ? "" : "table-xs"
              }`}
          >
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Cliente</th>
                <th>Modelo</th>
                <th>Items</th>
                <th>Costo</th>
                <th>Total</th>
                <th>Ganancia</th>
                <th>Origen</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {displayed.map((s, idx) => (
                <tr key={s.id ?? `sale-${idx}`}>
                  {/* Fecha (click para editar) */}
                  <td>
                    {isEditing(s.id, "date") ? (
                      <div className="flex items-center gap-2">
                        <input
                          autoFocus
                          type="date"
                          className="input input-xs w-36"
                          value={
                            getEditingValue(s.id, "date") ||
                            (s.date ? new Date(s.date).toISOString().slice(0, 10) : "")
                          }
                          onChange={(e) => updateEditingValue(s.id, "date", e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") commitEditField(s.id, "date");
                            if (e.key === "Escape") cancelEditField(s.id, "date");
                          }}
                          onBlur={() => commitEditField(s.id, "date")}
                          disabled={savingField?.saleId === s.id && savingField?.fieldName === "date"}
                        />
                        <div className='flex flex-col join join-horizontal border border-base-content/10'>
                          <button className="btn btn-ghost btn-xs join-item" onClick={() => commitEditField(s.id, 'date')}>
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="h-[1em]">
                              <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                            </svg>
                          </button>
                          <button className="btn btn-ghost btn-xs join-item" onClick={() => cancelEditField(s.id, 'date')}>
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="h-[1em]">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    ) : (
                      <span
                        className="cursor-pointer hover:bg-base-200 rounded px-1"
                        onClick={() => startEditField(s.id, "date", s.date ? new Date(s.date).toISOString().split('T')[0] : '')}
                        title="Click para editar"
                      >
                        <div className='tooltip tooltip-right' data-tip={s.date ? new Date(s.date).toLocaleString('es-AR') : ''}>
                          <span className="underline decoration-dotted cursor-help">
                            {s.date ? new Date(s.date).toLocaleDateString('es-AR', {
                              day: '2-digit',
                              month: '2-digit',
                            }) : '-'}
                          </span>
                        </div>
                      </span>
                    )}
                  </td>

                  {/* Cliente (buyer.name + buyer.surname) */}
                  <td>
                    {isEditing(s.id, "buyer.name") || isEditing(s.id, "buyer.surname") ? (
                      <div className="flex items-center gap-2">
                        <input
                          className="input input-xs w-24"
                          placeholder="Nombre"
                          value={getEditingValue(s.id, "buyer.name")}
                          onChange={(e) => updateEditingValue(s.id, "buyer.name", e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") commitEditField(s.id, "buyer.name"); // unifica
                            if (e.key === "Escape") {
                              cancelEditField(s.id, "buyer.name");
                              cancelEditField(s.id, "buyer.surname");
                            }
                          }}
                          autoFocus
                        />
                        <input
                          className="input input-xs w-24"
                          placeholder="Apellido"
                          value={getEditingValue(s.id, "buyer.surname")}
                          onChange={(e) => updateEditingValue(s.id, "buyer.surname", e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") commitEditField(s.id, "buyer.name");
                            if (e.key === "Escape") {
                              cancelEditField(s.id, "buyer.name");
                              cancelEditField(s.id, "buyer.surname");
                            }
                          }}
                        />
                        <div className="join join-horizontal">
                          <button className="btn btn-ghost btn-xs join-item" onClick={() => commitEditField(s.id, "buyer.name")}>
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="h-[1em]">
                              <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                            </svg>
                          </button>
                          <button className="btn btn-ghost btn-xs join-item" onClick={() => {
                            cancelEditField(s.id, "buyer.name");
                            cancelEditField(s.id, "buyer.surname");
                          }}>
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="h-[1em]">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    ) : (
                      <span
                        className="cursor-pointer hover:bg-base-200 rounded px-1"
                        title="Click para editar"
                        onClick={() => {
                          startEditField(s.id, "buyer.name", s.buyer?.name ?? "");
                          startEditField(s.id, "buyer.surname", s.buyer?.surname ?? "");
                        }}
                      >
                        {s.buyer
                          ? `${s.buyer.name ?? ''} ${s.buyer.surname ?? ''}`.trim() || '-'
                          : (s.customerName || '-')}
                      </span>
                    )}
                  </td>


                  {/* Modelo principal */}
                  <td>{getMainModel(s.items)}</td>

                  {/* Items (dropdown) */}
                  <td>
                    {Array.isArray(s.items) && s.items.length > 0 ? (
                      <div className="dropdown dropdown-hover">
                        <div tabIndex={0} role="button" className="btn btn-xs m-1">
                          {s.items.length} items
                        </div>
                        <ul
                          tabIndex={-1}
                          className="dropdown-content z-[1] menu p-2 shadow bg-base-100 rounded-box w-60"
                        >
                          {s.items.map((item: any, idx: number) => {
                            const k =
                              item?.id ??
                              item?.product?.id ??
                              `${item?.product?.modelName ?? "item"}-${idx}`;
                            return (
                              <li key={String(k)}>
                                <span>
                                  {item?.product?.modelName ?? "-"} ({item?.units ?? 0})
                                </span>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    ) : (
                      "-"
                    )}
                  </td>

                  {/* Costo */}
                  <td>
                    {isEditing(s.id, "costTotal") ? (
                      <div className="flex items-center gap-2">
                        <input
                          className="input input-xs w-20"
                          type="number"
                          step="0.01"
                          value={getEditingValue(s.id, "costTotal")}
                          onChange={(e) => updateEditingValue(s.id, "costTotal", e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") commitEditField(s.id, "costTotal");
                            if (e.key === "Escape") cancelEditField(s.id, "costTotal");
                          }}
                          onBlur={() => commitEditField(s.id, "costTotal")}
                        />
                        <div className='flex flex-col join join-horizontal border border-base-content/10'>
                          <button className="btn btn-ghost btn-xs join-item" onClick={() => commitEditField(s.id, 'costTotal')}>
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="h-[1em]">
                              <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                            </svg>
                          </button>
                          <button className="btn btn-ghost btn-xs join-item" onClick={() => cancelEditField(s.id, 'costTotal')}>
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="h-[1em]">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    ) : (
                      <span
                        className="cursor-pointer hover:bg-base-200 rounded px-1"
                        onClick={() => startEditField(s.id, 'costTotal', s.costTotal)}
                        title="Click para editar">
                        $ {s.costTotal ? Number(s.costTotal).toFixed(2) : "-"}
                      </span>
                    )}
                  </td>

                  {/* Total (editable decimal) */}
                  <td>
                    {isEditing(s.id, "total") ? (
                      <div className="flex items-center gap-2">
                        <input
                          className="input input-xs w-20"
                          type="number"
                          step="0.01"
                          value={getEditingValue(s.id, "total")}
                          onChange={(e) => updateEditingValue(s.id, "total", e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") commitEditField(s.id, "total");
                            if (e.key === "Escape") cancelEditField(s.id, "total");
                          }}
                          onBlur={() => commitEditField(s.id, "total")}
                          disabled={savingField?.saleId === s.id && savingField?.fieldName === "total"}
                        />
                        <div className='flex flex-col join join-horizontal border border-base-content/10'>
                          <button className="btn btn-ghost btn-xs join-item" onClick={() => commitEditField(s.id, 'total')}>
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="h-[1em]">
                              <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                            </svg>
                          </button>
                          <button className="btn btn-ghost btn-xs join-item" onClick={() => cancelEditField(s.id, 'total')}>
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="h-[1em]">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    ) : (
                      <span
                        className="cursor-pointer hover:bg-base-200 rounded px-1"
                        onClick={() => startEditField(s.id, "total", s.total)}
                        title="Click para editar"
                      >
                        $ {s.total ? Number(s.total).toFixed(2) : "-"}
                      </span>
                    )}
                  </td>

                  {/* Ganancia (editable decimal) */}
                  <td>
                    {isEditing(s.id, "profit") ? (
                      <div className="flex items-center gap-2">
                        <input
                          className="input input-xs w-20"
                          type="number"
                          step="0.01"
                          value={getEditingValue(s.id, "profit")}
                          onChange={(e) =>
                            updateEditingValue(s.id, "profit", e.target.value)
                          }
                          onKeyDown={(e) => {
                            if (e.key === "Enter") commitEditField(s.id, "profit");
                            if (e.key === "Escape") cancelEditField(s.id, "profit");
                          }}
                          onBlur={() => commitEditField(s.id, "profit")}
                        />
                        <div className='flex flex-col join join-horizontal border border-base-content/10'>
                          <button className="btn btn-ghost btn-xs join-item" onClick={() => commitEditField(s.id, 'profit')}>
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="h-[1em]">
                              <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                            </svg>
                          </button>
                          <button className="btn btn-ghost btn-xs join-item" onClick={() => cancelEditField(s.id, 'profit')}>
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="h-[1em]">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    ) : (
                      <span
                        className="cursor-pointer hover:bg-base-200 rounded px-1"
                        onClick={() => startEditField(s.id, "profit", s.profit)}
                        title="Click para editar"
                      >
                        $ {s.profit ? Number(s.profit).toFixed(2) : "-"}
                      </span>
                    )}
                  </td>

                  {/* Origen (editable select) */}
                  <td>
                    {isEditing(s.id, "origin") ? (
                      <div className="flex items-center gap-2">
                        <select
                          className="select select-xs w-20"
                          value={getEditingValue(s.id, "origin")}
                          onChange={(e) =>
                            updateEditingValue(s.id, "origin", e.target.value)
                          }
                          onKeyDown={(e) => {
                            if (e.key === "Enter") commitEditField(s.id, "origin");
                            if (e.key === "Escape") cancelEditField(s.id, "origin");
                          }}
                          onBlur={() => commitEditField(s.id, "origin")}
                          autoFocus
                        >
                          <option value="">Seleccionar</option>
                          {originOptions.map((opt) => (
                            <option key={opt} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </select>
                        <div className='flex flex-col join join-horizontal border border-base-content/10'>
                          <button className="btn btn-ghost btn-xs join-item" onClick={() => commitEditField(s.id, 'origin')}>
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="h-[1em]">
                              <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                            </svg>
                          </button>
                          <button className="btn btn-ghost btn-xs join-item" onClick={() => cancelEditField(s.id, 'origin')}>
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="h-[1em]">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    ) : (
                      <span
                        className="cursor-pointer hover:bg-base-200 rounded px-1"
                        onClick={() => startEditField(s.id, "origin", s.origin)}
                        title="Click para editar"
                      >
                        {s.origin ?? "-"}
                      </span>
                    )}
                  </td>

                  {/* Acciones */}
                  <td>
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/sales/${s.id}/edit`}
                        className="btn btn-xs btn-square btn-soft"
                      >
                        <svg width="800px" height="800px" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg" className="size-[1.2em]"><path fillRule="evenodd" clipRule="evenodd" d="m3.99 16.854-1.314 3.504a.75.75 0 0 0 .966.965l3.503-1.314a3 3 0 0 0 1.068-.687L18.36 9.175s-.354-1.061-1.414-2.122c-1.06-1.06-2.122-1.414-2.122-1.414L4.677 15.786a3 3 0 0 0-.687 1.068zm12.249-12.63 1.383-1.383c.248-.248.579-.406.925-.348.487.08 1.232.322 1.934 1.025.703.703.945 1.447 1.025 1.934.058.346-.1.677-.348.925L19.774 7.76s-.353-1.06-1.414-2.12c-1.06-1.062-2.121-1.415-2.121-1.415z" /></svg>
                      </Link>
                      <button
                        className="btn btn-xs btn-square btn-soft btn-error"
                        onClick={() => deleteSale(s.id)}
                        disabled={deletingId === s.id}
                        title="Eliminar"
                      >
                        {deletingId === s.id ?
                          <>
                            <span className="loading loading-bars loading-xs"></span>
                          </>
                          :
                          <>
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="size-[1.2em]">
                              <path fillRule="evenodd" d="M16.5 4.478v.227a48.816 48.816 0 0 1 3.878.512.75.75 0 1 1-.256 1.478l-.209-.035-1.005 13.07a3 3 0 0 1-2.991 2.77H8.084a3 3 0 0 1-2.991-2.77L4.087 6.66l-.209.035a.75.75 0 0 1-.256-1.478A48.567 48.567 0 0 1 7.5 4.705v-.227c0-1.564 1.213-2.9 2.816-2.951a52.662 52.662 0 0 1 3.369 0c1.603.051 2.815 1.387 2.815 2.951Zm-6.136-1.452a51.196 51.196 0 0 1 3.273 0C14.39 3.05 15 3.684 15 4.478v.113a49.488 49.488 0 0 0-6 0v-.113c0-.794.609-1.428 1.364-1.452Zm-.355 5.945a.75.75 0 1 0-1.5.058l.347 9a.75.75 0 1 0 1.499-.058l-.346-9Zm5.48.058a.75.75 0 1 0-1.498-.058l-.347 9a.75.75 0 0 0 1.5.058l.345-9Z" clipRule="evenodd" />
                            </svg>
                          </>
                        }
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
