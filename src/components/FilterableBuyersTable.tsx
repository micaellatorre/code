"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import SearchBar from "@/components/SearchBar";
import { ArrowsPointingInIcon, ArrowsPointingOutIcon, FunnelIcon, PencilIcon, TrashIcon } from '@heroicons/react/24/solid'

// ====== Tipos ======
type SerializedBuyer = {
  id: string;
  tenantId: string;
  name: string;
  surname: string | null;
  dob: string | null;
  phone: string | null;
  instagram: string | null;
  email: string | null;
  cuit: string | null;
  dni: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

// ====== Utils ======
const toStr = (v: any) => (v == null ? null : String(v));

function normalizeBuyers(input: any[]): SerializedBuyer[] {
  return (Array.isArray(input) ? input : []).map((b) => ({
    ...b,
    dob: b?.dob ?? null,
    createdAt: b?.createdAt ?? null,
    updatedAt: b?.updatedAt ?? null,
  }));
}

// ====== Componente ======
export default function FilterableBuyersTable({ initial }: { initial: SerializedBuyer[] }) {
  const [buyers, setBuyers] = useState<SerializedBuyer[]>(() =>
    normalizeBuyers(initial)
  );

  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(searchQuery.trim()), 300);
    return () => clearTimeout(t);
  }, [searchQuery]);

  const [loading, setLoading] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [isTableExpanded, setIsTableExpanded] = useState(false);

  // Filtros
  const [name, setName] = useState<string>("");
  const [surname, setSurname] = useState<string>("");
  const [phone, setPhone] = useState<string>("");
  const [instagram, setInstagram] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const [cuit, setCuit] = useState<string>("");
  const [dni, setDni] = useState<string>("");


  const [editingFields, setEditingFields] = useState<
    Record<string, Record<string, string>>
  >({});
  const [savingField, setSavingField] = useState<{
    buyerId: string;
    fieldName: string;
  } | null>(null);

  const [deletingId, setDeletingId] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const ctrlAbort = (ref: React.MutableRefObject<AbortController | null>) => {
    if (ref.current) {
      ref.current.abort();
      ref.current = null;
    }
  };

  useEffect(() => {
    let mounted = true;

    const doFetch = async () => {
      setLoading(true);
      if (abortRef.current) {
        abortRef.current.abort();
      }
      const ctrl = new AbortController();
      abortRef.current = ctrl;

      try {
        if (debouncedQuery) {
          const url = new URL("/api/buyers/search", location.origin);
          url.searchParams.set("q", debouncedQuery);
          const r = await fetch(url.toString(), {
            cache: "no-store",
            signal: ctrl.signal,
          });
          if (!r.ok) throw new Error(await r.text());
          const body = await r.json();
          if (mounted) setBuyers(normalizeBuyers(body?.results ?? []));
        } else {
          if (mounted) setBuyers(normalizeBuyers(initial));
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

  const displayed = useMemo(() => {
    const q = debouncedQuery.toLowerCase();

    return buyers.filter((b) => {
      if (q) {
        const hayTexto =
          (b.id ?? "").toLowerCase().includes(q) ||
          (b.name ?? "").toLowerCase().includes(q) ||
          (b.surname ?? "").toLowerCase().includes(q) ||
          (b.phone ?? "").toLowerCase().includes(q) ||
          (b.instagram ?? "").toLowerCase().includes(q) ||
          (b.email ?? "").toLowerCase().includes(q) ||
          (b.cuit ?? "").toLowerCase().includes(q) ||
          (b.dni ?? "").toLowerCase().includes(q);
        if (!hayTexto) return false;
      }

      if (name && !(b.name ?? "").toLowerCase().includes(name.toLowerCase())) return false;
      if (surname && !(b.surname ?? "").toLowerCase().includes(surname.toLowerCase())) return false;
      if (phone && !(b.phone ?? "").toLowerCase().includes(phone.toLowerCase())) return false;
      if (instagram && !(b.instagram ?? "").toLowerCase().includes(instagram.toLowerCase())) return false;
      if (email && !(b.email ?? "").toLowerCase().includes(email.toLowerCase())) return false;
      if (cuit && !(b.cuit ?? "").toLowerCase().includes(cuit.toLowerCase())) return false;
      if (dni && !(b.dni ?? "").toLowerCase().includes(dni.toLowerCase())) return false;

      return true;
    });
  }, [buyers, debouncedQuery, name, surname, phone, instagram, email, cuit, dni]);

  const isEditing = (buyerId: string, fieldName: string) =>
    editingFields[buyerId]?.[fieldName] !== undefined;

  const getEditingValue = (buyerId: string, fieldName: string) =>
    editingFields[buyerId]?.[fieldName] ?? "";

  const startEditField = (buyerId: string, fieldName: string, currentValue: any) => {
    setEditingFields((prev) => ({
      ...prev,
      [buyerId]: {
        ...prev[buyerId],
        [fieldName]: currentValue == null ? "" : String(currentValue),
      },
    }));
  };

  const updateEditingValue = (buyerId: string, fieldName: string, value: string) => {
    setEditingFields((prev) => ({
      ...prev,
      [buyerId]: {
        ...prev[buyerId],
        [fieldName]: value,
      },
    }));
  };

  const cancelEditField = (buyerId: string, fieldName: string) => {
    setEditingFields((prev) => {
      const next = { ...prev };
      const buyerMap = { ...(next[buyerId] || {}) };
      delete buyerMap[fieldName];
      if (Object.keys(buyerMap).length === 0) delete next[buyerId];
      else next[buyerId] = buyerMap;
      return next;
    });
  };

  async function persistFieldUpdate(buyerId: string, fieldName: string, value: any) {
    setSavingField({ buyerId, fieldName });
    try {
      const res = await fetch(`/api/buyers/${buyerId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [fieldName]: value }),
      });
      if (!res.ok) throw new Error(await res.text());
      const body = await res.json();
      setBuyers((prev) =>
        prev.map((b) => (b.id === buyerId ? normalizeBuyers([body.buyer])[0] ?? b : b))
      );

      cancelEditField(buyerId, fieldName);
    } catch (err) {
      console.error(`Failed to persist ${fieldName} update`, err);
      alert("No se pudo guardar. Se revirtieron los cambios.");
      setBuyers((_) => normalizeBuyers(initial));
    } finally {
      setSavingField(null);
    }
  }

  function commitEditField(buyerId: string, fieldName: string) {
    const editingValue = editingFields[buyerId]?.[fieldName];
    if (editingValue === undefined) return;

    const row = buyers.find((b) => b.id === buyerId);
    if (!row) return;

    let processed: any =
      typeof editingValue === "string" ? editingValue.trim() : editingValue;
    if (processed === "") processed = null;

    if (fieldName === "dob" && processed) {
      const d = new Date(processed);
      if (isNaN(d.getTime())) return;
      processed = d.toISOString();
    }

    setBuyers((prev) =>
      prev.map((b) => (b.id === buyerId ? { ...b, [fieldName]: processed } : b))
    );

    persistFieldUpdate(buyerId, fieldName, processed);
  }

  const deleteBuyer = async (id: string) => {
    if (!window.confirm("¿Está seguro que desea eliminar este cliente?")) return;
    setDeletingId(id);

    const snapshot = buyers;
    setBuyers((prev) => prev.filter((b) => b.id !== id));

    try {
      const res = await fetch(`/api/buyers/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(await res.text());
    } catch (err) {
      console.error("Delete failed", err);
      alert("No se pudo eliminar el cliente. Revirtiendo cambios.");
      setBuyers(snapshot);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-between items-center">
        <div className="flex flex-row items-center justify-between gap-2">
          <h2 className="text-2xl font-bold">
            Clientes
            <span className="ml-4 text-sm text-base-content/60">
              - Resultados {displayed.length}
            </span>
            <span className="ml-1 text-sm text-base-content/30">de</span>
            <span className="ml-1 text-sm text-base-content/30">
              {buyers.length}
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
              <ArrowsPointingInIcon className="size-6" />
            ) : (
              <ArrowsPointingOutIcon className="size-6" />
            )}
          </button>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/buyers/new" className="btn btn-primary">
            Nuevo Cliente
          </Link>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 w-full">
          <SearchBar
            placeholder="Buscar clientes por nombre, DNI, etc..."
            onSearch={setSearchQuery}
          />
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={() => setDrawerOpen(true)}
            title="Abrir filtros"
          >
            <FunnelIcon className="w-5 h-5 mr-1" />
            Filtros
          </button>
        </div>
      </div>

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
                  <label className="label"><span className="label-text">Nombre</span></label>
                  <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="input input-bordered" />
                </div>
                <div className="form-control">
                  <label className="label"><span className="label-text">Apellido</span></label>
                  <input type="text" value={surname} onChange={(e) => setSurname(e.target.value)} className="input input-bordered" />
                </div>
                <div className="form-control">
                  <label className="label"><span className="label-text">Teléfono</span></label>
                  <input type="text" value={phone} onChange={(e) => setPhone(e.target.value)} className="input input-bordered" />
                </div>
                <div className="form-control">
                  <label className="label"><span className="label-text">Instagram</span></label>
                  <input type="text" value={instagram} onChange={(e) => setInstagram(e.target.value)} className="input input-bordered" />
                </div>
                <div className="form-control">
                  <label className="label"><span className="label-text">Email</span></label>
                  <input type="text" value={email} onChange={(e) => setEmail(e.target.value)} className="input input-bordered" />
                </div>
                <div className="form-control">
                  <label className="label"><span className="label-text">CUIT</span></label>
                  <input type="text" value={cuit} onChange={(e) => setCuit(e.target.value)} className="input input-bordered" />
                </div>
                <div className="form-control">
                  <label className="label"><span className="label-text">DNI</span></label>
                  <input type="text" value={dni} onChange={(e) => setDni(e.target.value)} className="input input-bordered" />
                </div>

                <div className="divider" />

                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => {
                    setName("");
                    setSurname("");
                    setPhone("");
                    setInstagram("");
                    setEmail("");
                    setCuit("");
                    setDni("");
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

      <input
        id="filters-drawer"
        type="checkbox"
        className="hidden"
        checked={drawerOpen}
        onChange={(e) => setDrawerOpen(e.target.checked)}
      />

      <div className="relative overflow-x-auto rounded-box border border-base-content/5 bg-base-100 h-[70dvh]">
        {loading && (
          <div className="absolute inset-0 bg-base-100/70 backdrop-blur-[1px] z-10 flex items-center justify-center text-sm text-base-content/60">
            Buscando…
          </div>
        )}

        {displayed.length === 0 ? (
          <div className="p-8 text-center text-base-content/60">
            {debouncedQuery || name || surname || phone || instagram || email || cuit || dni
              ? "No hay resultados con los filtros aplicados."
              : "Aún no hay clientes para mostrar."}
          </div>
        ) : (
          <table
            className={`table table-zebra w-full table-pin-rows table-pin-cols ${isTableExpanded ? "" : "table-xs"
              }`}
          >
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Apellido</th>
                <th>Teléfono</th>
                <th>Instagram</th>
                <th>Email</th>
                <th>CUIT</th>
                <th>DNI</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {displayed.map((b, idx) => (
                <tr key={b.id ?? `buyer-${idx}`}>
                  <td>{b.name}</td>
                  <td>{b.surname}</td>
                  <td>{b.phone}</td>
                  <td>{b.instagram}</td>
                  <td>{b.email}</td>
                  <td>{b.cuit}</td>
                  <td>{b.dni}</td>
                  <td>
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/buyers/${b.id}/edit`}
                        className="btn btn-xs btn-square btn-soft"
                      >
                        <PencilIcon className="size-[1.2em]" />
                      </Link>
                      <button
                        className="btn btn-xs btn-square btn-soft btn-error"
                        onClick={() => deleteBuyer(b.id)}
                        disabled={deletingId === b.id}
                        title="Eliminar"
                      >
                        {deletingId === b.id ?
                          <>
                            <span className="loading loading-bars loading-xs"></span>
                          </>
                          :
                          <>
                            <TrashIcon className="size-[1.2em]" />
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