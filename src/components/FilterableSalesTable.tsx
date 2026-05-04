"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import SearchBar from "@/components/SearchBar";
import { DateRangePicker, DateRangePickerItem, type DateRangePickerValue } from "@tremor/react";
import { ArrowsPointingInIcon, ArrowsPointingOutIcon, FunnelIcon, CheckIcon, XMarkIcon, PencilIcon, TrashIcon, ArrowTrendingDownIcon, CurrencyDollarIcon, ArrowTrendingUpIcon } from '@heroicons/react/24/solid'
import { formatInTimeZone } from 'date-fns-tz'
import { startOfDay, endOfDay } from 'date-fns'
import { es } from "date-fns/locale"
import { AR_TIME_ZONE, toArgDateInputValue, fromArgDateInputValue } from '@/lib/timezone'
import type { Role } from "@/lib/auth/roles";

// ====== Tipos ======
type SaleUserSummary = {
  id: string;
  name: string | null;
  email: string;
};

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
  createdBy: string;
  createdByUser: SaleUserSummary | null;
};

type UserSearchResult = {
  id: string;
  name: string | null;
  email: string;
  role: Role;
};

// ====== Utils ======
const toStr = (v: any) => (v == null ? null : String(v));

function displayUser(user: SaleUserSummary | null) {
  if (!user) return "-";
  return user.name?.trim() || user.email;
}

function toDateParam(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function fromDateParam(value: string) {
  return value ? new Date(`${value}T00:00:00`) : undefined;
}

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
    createdByUser: s?.createdByUser ?? s?.user ?? null,
    createdBy: s?.createdBy ?? displayUser(s?.createdByUser ?? s?.user ?? null),
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
  const { data: session } = useSession();
  const activeRole = (session?.user as { activeRole?: Role } | undefined)?.activeRole;
  const isAdmin = activeRole === "ADMIN";
  const isSeller = activeRole === "VENDEDOR";
  const isStock = activeRole === "STOCK";
  const isSocio = activeRole === "SOCIO";
  const canSeeCosts = isAdmin || isSocio;
  const canSeeProfit = isAdmin || isSocio;
  const canSeeTotal = isAdmin || isSeller || isSocio;
  const canSeeFinancialStats = isAdmin || isSocio;
  const canCreateSales = isAdmin || isSeller;
  const canEditSales = isAdmin || isSeller;
  const canDeleteSales = isAdmin;
  const canEditSensitiveFinancialFields = isAdmin;
  const isReadOnly = !canEditSales && !canDeleteSales;
  const hasSaleActions = canEditSales || canDeleteSales;

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
  const [editingCreatedById, setEditingCreatedById] = useState<string | null>(null);
  const [userSearchQuery, setUserSearchQuery] = useState("");
  const [debouncedUserSearchQuery, setDebouncedUserSearchQuery] = useState("");
  const [userSearchResults, setUserSearchResults] = useState<UserSearchResult[]>([]);
  const [isSearchingUsers, setIsSearchingUsers] = useState(false);
  const [isSavingCreatedBy, setIsSavingCreatedBy] = useState(false);

  // Filtros
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [minTotal, setMinTotal] = useState<string>("");
  const [maxTotal, setMaxTotal] = useState<string>("");
  const [minProfit, setMinProfit] = useState<string>("");
  const [maxProfit, setMaxProfit] = useState<string>("");

  const dateRangeValue = useMemo<DateRangePickerValue>(
    () => ({
      from: fromDateParam(startDate),
      to: fromDateParam(endDate),
    }),
    [endDate, startDate],
  );

  const rangePresets = useMemo(() => {
    const today = new Date();
    const currentMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const currentYearStart = new Date(today.getFullYear(), 0, 1);

    return [
      {
        key: "last-7-days",
        label: "Ultimos 7 dias",
        from: new Date(today.getFullYear(), today.getMonth(), today.getDate() - 6),
        to: today,
      },
      {
        key: "last-30-days",
        label: "Ultimos 30 dias",
        from: new Date(today.getFullYear(), today.getMonth(), today.getDate() - 29),
        to: today,
      },
      {
        key: "current-month",
        label: "Mes actual",
        from: currentMonthStart,
        to: today,
      },
      {
        key: "ytd",
        label: "Ano transcurrido",
        from: currentYearStart,
        to: today,
      },
    ];
  }, []);

  useEffect(() => {
    if (!activeRole) return;
    if (!canSeeTotal) {
      setMinTotal("");
      setMaxTotal("");
    }
    if (!canSeeProfit) {
      setMinProfit("");
      setMaxProfit("");
    }
  }, [activeRole, canSeeProfit, canSeeTotal]);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedUserSearchQuery(userSearchQuery.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [userSearchQuery]);

  useEffect(() => {
    if (!editingCreatedById || !isAdmin) {
      setUserSearchResults([]);
      setIsSearchingUsers(false);
      return;
    }

    let ignore = false;
    const ctrl = new AbortController();

    async function run() {
      setIsSearchingUsers(true);
      try {
        const params = new URLSearchParams();
        params.set("q", debouncedUserSearchQuery);
        const response = await fetch(`/api/users/search?${params.toString()}`, {
          method: "GET",
          cache: "no-store",
          signal: ctrl.signal,
        });

        if (!response.ok) {
          throw new Error(await response.text());
        }

        const body = (await response.json()) as { results?: UserSearchResult[] };
        if (!ignore) {
          setUserSearchResults(Array.isArray(body.results) ? body.results : []);
        }
      } catch (error: any) {
        if (!ignore && error?.name !== "AbortError") {
          console.error("Failed to search users", error);
          setUserSearchResults([]);
        }
      } finally {
        if (!ignore) {
          setIsSearchingUsers(false);
        }
      }
    }

    void run();

    return () => {
      ignore = true;
      ctrl.abort();
    };
  }, [debouncedUserSearchQuery, editingCreatedById, isAdmin]);

  useEffect(() => {
    if (!editingCreatedById) return;

    function handleClickOutside(event: MouseEvent) {
      if (editorRef.current && !editorRef.current.contains(event.target as Node) && !isSavingCreatedBy) {
        closeCreatedByEditor();
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [editingCreatedById, isSavingCreatedBy]);

  function clearFilters() {
    setSearchQuery("");
    setStartDate("");
    setEndDate("");
    setMinTotal("");
    setMaxTotal("");
    setMinProfit("");
    setMaxProfit("");
  }

  function handleRangeChange(value: DateRangePickerValue) {
    setStartDate(value.from ? toDateParam(value.from) : "");
    setEndDate(value.to ? toDateParam(value.to) : "");
  }

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
  const editorRef = useRef<HTMLDivElement | null>(null);
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
          (s.createdBy ?? "").toLowerCase().includes(q) ||
          (s.createdByUser?.email ?? "").toLowerCase().includes(q) ||
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
        const sDateUTC = new Date(s.date);

        if (startDate) {
          const startOfArgDayUTC = startOfDay(fromArgDateInputValue(startDate));
          if (sDateUTC < startOfArgDayUTC) return false;
        }
        if (endDate) {
          const endOfArgDayUTC = endOfDay(fromArgDateInputValue(endDate));
          if (sDateUTC > endOfArgDayUTC) return false;
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

  function canEditField(fieldName: string) {
    if (["costTotal", "profit", "total"].includes(fieldName)) {
      return canEditSales && canEditSensitiveFinancialFields;
    }

    return canEditSales;
  }

  function openCreatedByEditor(sale: SerializedSale) {
    if (!isAdmin || isSavingCreatedBy) return;
    setEditingCreatedById(sale.id);
    setUserSearchQuery("");
    setDebouncedUserSearchQuery("");
    setUserSearchResults([]);
  }

  function closeCreatedByEditor() {
    setEditingCreatedById(null);
    setUserSearchQuery("");
    setDebouncedUserSearchQuery("");
    setUserSearchResults([]);
  }

  async function handleSelectCreatedBy(saleId: string, user: UserSearchResult) {
    if (!isAdmin) return;

    setIsSavingCreatedBy(true);
    try {
      const response = await fetch(`/api/sales/${saleId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id }),
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      const body = await response.json();
      const updated = normalizeSales([body.sale])[0];
      const nextUser = updated?.createdByUser ?? {
        id: user.id,
        name: user.name,
        email: user.email,
      };

      setItems((prev) =>
        prev.map((sale) =>
          sale.id === saleId
            ? {
              ...(updated ?? sale),
              createdByUser: nextUser,
              createdBy: displayUser(nextUser),
            }
            : sale
        )
      );

      closeCreatedByEditor();
    } catch (error) {
      console.error("Failed to update sale user", error);
    } finally {
      setIsSavingCreatedBy(false);
    }
  }

  function editableCellProps(saleId: string, fieldName: string, currentValue: any) {
    if (!canEditField(fieldName)) {
      return {
        className: "rounded px-1",
      };
    }

    return {
      className: "cursor-pointer hover:bg-base-200 rounded px-1",
      onClick: () => startEditField(saleId, fieldName, currentValue),
      title: "Click para editar",
    };
  }

  const startEditField = (saleId: string, fieldName: string, currentValue: any) => {
    if (!canEditField(fieldName)) return;

    let formattedValue = currentValue;
    if (fieldName === "date" && currentValue) {
      formattedValue = toArgDateInputValue(new Date(currentValue)); // currentValue is ISO string
    } else {
      formattedValue = currentValue == null ? "" : String(currentValue);
    }
    setEditingFields((prev) => ({
      ...prev,
      [saleId]: {
        ...prev[saleId],
        [fieldName]: formattedValue,
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
    if (!canEditField(fieldName)) return;

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
    if (!canEditField(fieldName)) return;

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
      processed = fromArgDateInputValue(processed).toISOString();
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
    if (!canDeleteSales) return;

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
    <div className="flex flex-col gap-2 sm:gap-4">
      <div className="flex flex-wrap justify-between items-center gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex flex-row items-center justify-between gap-2">
            <h2 className="text-2xl font-bold hidden sm:block">
              Ventas
            </h2>
            <div className="flex flex-grow flex-wrap gap-4 rounded-box bg-base-200 p-2 items-center">
              <div className="flex flex-row gap-1">
                <span className="ml-1 text-sm text-base-content/60">
                  Resultados {displayed.length}
                </span>
                <span className="text-sm text-base-content/30">de</span>
                <span className="text-sm text-base-content/30">
                  {items.length}
                </span>
              </div>
              <button
                type="button"
                className="btn btn-ghost btn-xs sm:btn-sm btn-outline border border-base-content/10 h-[2.4em] flex items-center"
                onClick={() => setIsTableExpanded(!isTableExpanded)}
                title={isTableExpanded ? "Contraer tabla" : "Expandir tabla"}
              >
                {isTableExpanded ? 'Comprimir' : 'Expandir '} Tabla
                {isTableExpanded ? (
                  <ArrowsPointingInIcon className="size-6" />
                ) : (
                  <ArrowsPointingOutIcon className="size-6" />
                )}
              </button>
            </div>
          </div>
          {canSeeFinancialStats ? (
            <div className="stats rounded-box bg-base-200 p-2">
              <div className="stat px-1 sm:px-4 py-2 text-error">
                <div className="stat-figure text-error">
                  <ArrowTrendingDownIcon className="size-6 hidden sm:block" />
                </div>
                <div className="stat-title text-xs">Total Costos</div>
                <div className="stat-value text-xs sm:text-base">
                  ${displayed.reduce((acc, s) => acc + (s.costTotal ? parseFloat(s.costTotal) : 0), 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>

              <div className="stat sm:px-4 py-2 pr-0 pl-2">
                <div className="stat-figure text-warning">
                  <CurrencyDollarIcon className="size-6 hidden sm:block" />
                </div>
                <div className="stat-title text-xs">Total Ventas</div>
                <div className="stat-value text-xs sm:text-base text-warning">
                  ${displayed.reduce((acc, s) => acc + (s.total ? parseFloat(s.total) : 0), 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>

              <div className="stat sm:px-4 py-2 pr-0 pl-2">
                <div className="stat-figure text-success">
                  <ArrowTrendingUpIcon className="size-6 hidden sm:block" />
                </div>
                <div className="stat-title text-xs">Total Ganancias</div>
                <div className="stat-value text-xs sm:text-base text-success">
                  ${displayed.reduce((acc, s) => acc + (s.profit ? parseFloat(s.profit) : 0), 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>
            </div>
          ) : null}
        </div>
        {canCreateSales ? (
          <div className="items-center gap-2 hidden sm:flex">
            <Link href="/dashboard/sales/new" className="btn btn-primary">
              Nueva Venta
            </Link>
          </div>
        ) : null}
      </div>

      {/* Header: búsqueda, filtros */}
      <div className="relative z-[80] flex items-center justify-between">
        <div className="flex flex-grow flex-wrap gap-2 sm:gap-4 rounded-box bg-base-200 p-2 items-center">
          <SearchBar
            placeholder="Buscar ventas por cliente, id o modelo..."
            onSearch={setSearchQuery}
          />

          <DateRangePicker
            className="relative z-[90] w-64 flex-grow text-xs sm:text-sm"
            value={dateRangeValue}
            onValueChange={handleRangeChange}
            enableClear
            displayFormat="dd/MM/yyyy"
            enableYearNavigation
            weekStartsOn={1}
            locale={es}
            selectPlaceholder="Seleccionar"
            color="blue"
          >
            {rangePresets.map((preset) => (
              <DateRangePickerItem key={preset.key} value={preset.key} from={preset.from} to={preset.to}>
                {preset.label}
              </DateRangePickerItem>
            ))}
          </DateRangePicker>
          <button
            type="button"
            className="btn btn-outline btn-xs sm:btn-sm"
            onClick={() => setDrawerOpen(true)}
            title="Abrir filtros"
          >
            <FunnelIcon className="size-5 sm:size-6 mr-1" />
            Filtros
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-xs sm:btn-sm"
            onClick={clearFilters}
          >
            Limpiar
          </button>
        </div>
      </div>
      {(startDate || endDate || minTotal || maxTotal || minProfit || maxProfit) && (
        <div className="flex items-center gap-2">
          {(startDate || endDate) && (
            <span className="badge badge-sm badge-soft h-8 pl-3 pr-1 py-2">
              Fecha: {startDate ? `desde ${startDate}` : ''}{startDate && endDate ? ' ' : ''}{endDate ? `hasta ${endDate}` : ''}
              <button
                type="button"
                className="btn btn-ghost btn-xs btn-circle ml-1"
                onClick={() => {
                  setStartDate('');
                  setEndDate('');
                }}
              >
                ✕
              </button>
            </span>
          )}
          {canSeeTotal && (minTotal || maxTotal) && (
            <span className="badge badge-sm badge-soft h-8 pl-3 pr-1 py-2">
              Total: {minTotal ? `Min $${minTotal}` : ''}{minTotal && maxTotal ? ' - ' : ''}{maxTotal ? `Max $${maxTotal}` : ''}
              <button
                type="button"
                className="btn btn-ghost btn-xs btn-circle ml-1"
                onClick={() => {
                  setMinTotal('');
                  setMaxTotal('');
                }}
              >
                ✕
              </button>
            </span>
          )}
          {canSeeProfit && (minProfit || maxProfit) && (
            <span className="badge badge-sm badge-soft h-8 pl-3 pr-1 py-2">
              Ganancia: {minProfit ? `Min $${minProfit}` : ''}{minProfit && maxProfit ? ' - ' : ''}{maxProfit ? `Max $${maxProfit}` : ''}
              <button
                type="button"
                className="btn btn-ghost btn-xs btn-circle ml-1"
                onClick={() => {
                  setMinProfit('');
                  setMaxProfit('');
                }}
              >
                ✕
              </button>
            </span>
          )}
        </div>
      )}
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

              <div className="flex flex-col gap-2 sm:gap-4">
                {canSeeTotal ? (
                  <>
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
                  </>
                ) : null}
                {canSeeProfit ? (
                  <>
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
                  </>
                ) : null}

                <div className="divider" />

                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={clearFilters}
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
      <div className="relative z-0 overflow-x-auto rounded-box border border-base-content/5 bg-base-100 h-[70dvh]">
        {loading && (
          <div className="absolute inset-0 bg-base-100/70 backdrop-blur-[1px] flex items-center justify-center text-sm text-base-content/60">
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
                <th>Vendido por</th>
                <th>Cliente</th>
                <th>Modelo</th>
                <th>Items</th>
                {canSeeCosts ? <th>Costo</th> : null}
                {canSeeTotal ? <th>Total</th> : null}
                {canSeeProfit ? <th>Ganancia</th> : null}
                <th>Origen</th>
                {hasSaleActions ? <th>Acciones</th> : null}
              </tr>
            </thead>
            <tbody>
              {displayed.map((s, idx) => {
                const isEditingCreatedBy = editingCreatedById === s.id;

                return (
                  <tr key={s.id ?? `sale-${idx}`}>
                    {/* Fecha (click para editar) */}
                    <td>
                      {canEditField("date") && isEditing(s.id, "date") ? (
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
                              <CheckIcon className="h-[1em]" />
                            </button>
                            <button className="btn btn-ghost btn-xs join-item" onClick={() => cancelEditField(s.id, 'date')}>
                              <XMarkIcon className="h-[1em]" />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <span {...editableCellProps(s.id, "date", s.date ? new Date(s.date).toISOString().split('T')[0] : '')}>
                          <div className='tooltip tooltip-right' data-tip={s.date ? formatInTimeZone(new Date(s.date), AR_TIME_ZONE, 'dd/MM/yyyy HH:mm') : ''}>
                            <span className="underline decoration-dotted cursor-help">
                              {s.date ? formatInTimeZone(new Date(s.date), AR_TIME_ZONE, 'dd/MM/yyyy') : '-'}
                            </span>
                          </div>
                        </span>
                      )}
                    </td>

                    <td className="align-top">
                      {!isAdmin ? (
                        s.createdBy || "-"
                      ) : isEditingCreatedBy ? (
                        <div ref={editorRef} className="relative min-w-[18rem]">
                          <input
                            type="text"
                            autoFocus
                            value={userSearchQuery}
                            onChange={(e) => setUserSearchQuery(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Escape" && !isSavingCreatedBy) {
                                closeCreatedByEditor()
                              }
                            }}
                            placeholder="Buscar usuario..."
                            disabled={isSavingCreatedBy}
                            className="input input-bordered input-sm w-full"
                          />
                          <div className="absolute z-20 mt-1 w-full rounded-box border border-base-300 bg-base-100 shadow-lg">
                            {isSavingCreatedBy ? (
                              <div className="px-3 py-2 text-sm text-base-content/70">Guardando...</div>
                            ) : isSearchingUsers ? (
                              <div className="px-3 py-2 text-sm text-base-content/70">Buscando...</div>
                            ) : userSearchResults.length === 0 ? (
                              <div className="px-3 py-2 text-sm text-base-content/70">Sin resultados</div>
                            ) : (
                              <ul className="max-h-60 overflow-y-auto py-1">
                                {userSearchResults.map((user) => (
                                  <li key={user.id}>
                                    <button
                                      type="button"
                                      className="flex w-full items-start justify-between gap-3 px-3 py-2 text-left hover:bg-base-200 disabled:cursor-not-allowed disabled:opacity-60"
                                      onClick={() => handleSelectCreatedBy(s.id, user)}
                                      disabled={isSavingCreatedBy}
                                    >
                                      <span className="flex min-w-0 flex-col">
                                        <span className="truncate text-sm font-medium">{user.name?.trim() || user.email}</span>
                                        <span className="truncate text-xs text-base-content/60">{user.email}</span>
                                      </span>
                                      <span className="badge badge-outline badge-sm shrink-0">{user.role}</span>
                                    </button>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        </div>
                      ) : (
                        <button
                          type="button"
                          className="cursor-pointer rounded px-1 text-left hover:bg-base-200"
                          onClick={() => openCreatedByEditor(s)}
                          title="Click para reasignar"
                        >
                          {s.createdBy || "-"}
                        </button>
                      )}
                    </td>

                    {/* Cliente (buyer.name + buyer.surname) */}
                    <td>
                      {canEditField("buyer.name") && (isEditing(s.id, "buyer.name") || isEditing(s.id, "buyer.surname")) ? (
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
                              <CheckIcon className="h-[1em]" />
                            </button>
                            <button className="btn btn-ghost btn-xs join-item" onClick={() => {
                              cancelEditField(s.id, "buyer.name");
                              cancelEditField(s.id, "buyer.surname");
                            }}>
                              <XMarkIcon className="h-[1em]" />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <span
                          {...(canEditField("buyer.name")
                            ? {
                              className: "cursor-pointer hover:bg-base-200 rounded px-1",
                              title: "Click para editar",
                              onClick: () => {
                                startEditField(s.id, "buyer.name", s.buyer?.name ?? "");
                                startEditField(s.id, "buyer.surname", s.buyer?.surname ?? "");
                              },
                            }
                            : {
                              className: "rounded px-1",
                            })}
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
                              // console.log('item', item)
                              return (
                                <li key={String(k)}>
                                  <Link
                                    href={`/dashboard/products/${item?.productId}/edit`}
                                    className="btn btn-xs btn-ghost gap-1 flex flex-row justify-between"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                  >
                                    {String(item?.product?.type ?? "").toUpperCase() === "PHONE" ? (
                                      <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        fill="none"
                                        viewBox="0 0 24 24"
                                        strokeWidth="1.5"
                                        stroke="currentColor"
                                        className="size-4"
                                      >
                                        <path
                                          strokeLinecap="round"
                                          strokeLinejoin="round"
                                          d="M10.5 1.5H8.25A2.25 2.25 0 0 0 6 3.75v16.5a2.25 2.25 0 0 0 2.25 2.25h7.5A2.25 2.25 0 0 0 18 20.25V3.75a2.25 2.25 0 0 0-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3"
                                        />
                                      </svg>
                                    ) : (
                                      <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        fill="none"
                                        viewBox="0 0 24 24"
                                        strokeWidth="1.5"
                                        stroke="currentColor"
                                        className="size-4"
                                      >
                                        <path
                                          strokeLinecap="round"
                                          strokeLinejoin="round"
                                          d="M15.75 10.5V6a3.75 3.75 0 1 0-7.5 0v4.5m11.356-1.993 1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 0 1-1.12-1.243l1.264-12A1.125 1.125 0 0 1 5.513 7.5h12.974c.576 0 1.059.435 1.119 1.007ZM8.625 10.5a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm7.5 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z"
                                        />
                                      </svg>
                                    )}
                                    <span className="text-left truncate w-full max-w-[10rem]">
                                      {item?.product?.modelName ?? "-"}
                                    </span>
                                    <span>
                                      ({item?.units ?? 0})
                                    </span>
                                  </Link>
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
                    {canSeeCosts ? (
                      <td>
                        {canEditField("costTotal") && isEditing(s.id, "costTotal") ? (
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
                                <CheckIcon className="h-[1em]" />
                              </button>
                              <button className="btn btn-ghost btn-xs join-item" onClick={() => cancelEditField(s.id, 'costTotal')}>
                                <XMarkIcon className="h-[1em]" />
                              </button>
                            </div>
                          </div>
                        ) : (
                          <span {...editableCellProps(s.id, "costTotal", s.costTotal)}>
                            $ {s.costTotal ? Number(s.costTotal).toFixed(2) : "-"}
                          </span>
                        )}
                      </td>
                    ) : null}

                    {/* Total (editable decimal) */}
                    {canSeeTotal ? (
                      <td>
                        {canEditField("total") && isEditing(s.id, "total") ? (
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
                                <CheckIcon className="h-[1em]" />
                              </button>
                              <button className="btn btn-ghost btn-xs join-item" onClick={() => cancelEditField(s.id, 'total')}>
                                <XMarkIcon className="h-[1em]" />
                              </button>
                            </div>
                          </div>
                        ) : (
                          <span {...editableCellProps(s.id, "total", s.total)}>
                            $ {s.total ? Number(s.total).toFixed(2) : "-"}
                          </span>
                        )}
                      </td>
                    ) : null}

                    {/* Ganancia (editable decimal) */}
                    {canSeeProfit ? (
                      <td>
                        {canEditField("profit") && isEditing(s.id, "profit") ? (
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
                                <CheckIcon className="h-[1em]" />
                              </button>
                              <button className="btn btn-ghost btn-xs join-item" onClick={() => cancelEditField(s.id, 'profit')}>
                                <XMarkIcon className="h-[1em]" />
                              </button>
                            </div>
                          </div>
                        ) : (
                          <span {...editableCellProps(s.id, "profit", s.profit)}>
                            $ {s.profit ? Number(s.profit).toFixed(2) : "-"}
                          </span>
                        )}
                      </td>
                    ) : null}

                    {/* Origen (editable select) */}
                    <td>
                      {canEditField("origin") && isEditing(s.id, "origin") ? (
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
                              <CheckIcon className="h-[1em]" />
                            </button>
                            <button className="btn btn-ghost btn-xs join-item" onClick={() => cancelEditField(s.id, 'origin')}>
                              <XMarkIcon className="h-[1em]" />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <span {...editableCellProps(s.id, "origin", s.origin)}>
                          {s.origin ?? "-"}
                        </span>
                      )}
                    </td>

                    {/* Acciones */}
                    {hasSaleActions ? (
                      <td>
                        <div className="flex items-center gap-2">
                          {canEditSales ? (
                            <Link
                              href={`/dashboard/sales/${s.id}/edit`}
                              className="btn btn-xs btn-square btn-soft"
                            >
                              <PencilIcon className="size-[1.2em]" />
                            </Link>
                          ) : null}
                          {canDeleteSales ? (
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
                                  <TrashIcon className="size-[1.2em]" />
                                </>
                              }
                            </button>
                          ) : null}
                        </div>
                      </td>
                    ) : null}
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
