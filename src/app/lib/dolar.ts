// src/app/lib/dolar.ts
import { z } from "zod";
import { fetchWithRetry } from "./http";

export type DolarPanelItem = {
  titulo: string;
  venta?: number | null;
  compra?: number | null;
  apertura?: number | null;
  cierre?: number | null;
  historico?: number | null;
  fecha?: string | null;
  lastUpdate?: string | null;
  nextMonths?: Array<{
    month: string;
    compra?: number | null;
    venta?: number | null;
    variacion?: string | number | null;
  }>;
};

export type DolarResponse = {
  panel: DolarPanelItem[];
  publicidades: unknown[];
};

const RawItem = z.object({
  titulo: z.string(),
  venta: z.string().optional(),
  compra: z.string().optional(),
  apertura: z.string().optional(),
  cierre: z.string().optional(),
  historico: z.string().optional(),
  fecha: z.string().optional(),
  lastUpdate: z.string().optional(),
  nextMonths: z.array(z.object({
    month: z.string(),
    compra: z.string().optional(),
    venta: z.string().optional(),
    variacion: z.string().optional(),
  })).optional()
});

const RawSchema = z.object({
  panel: z.array(RawItem),
  publicidades: z.array(z.any())
});

const DolarApiItem = z.object({
  casa: z.string().optional(),
  nombre: z.string(),
  compra: z.number().nullable().optional(),
  venta: z.number().nullable().optional(),
  fechaActualizacion: z.string().nullable().optional()
});

const DolarApiSchema = z.array(DolarApiItem);

const DEFAULT_ENDPOINT = "https://backend-ifa-production-a92c.up.railway.app/api/dolar/v2/general";
const PUBLIC_FALLBACK_ENDPOINT = "https://dolarapi.com/v1/dolares";

// Cache en memoria para fallback (stale-on-error)
let LAST_OK: DolarResponse | null = null;
let LAST_OK_AT = 0;

export function toNumberOrNull(v?: string): number | null {
  if (!v) return null;
  const trimmed = v.trim();
  if (!trimmed) return null;
  let s = trimmed.replace(/\s+/g, "");
  const lastDot = s.lastIndexOf(".");
  const lastComma = s.lastIndexOf(",");
  if (lastComma > lastDot) {
    s = s.replace(/\./g, "").replace(",", ".");
  } else if (lastDot > lastComma) {
    s = s.replace(/,/g, "");
  } else if (s.includes(",") && !s.includes(".")) {
    s = s.replace(/\./g, "").replace(",", ".");
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function normalizeItem(i: z.infer<typeof RawItem>): DolarPanelItem {
  return {
    titulo: i.titulo,
    venta: toNumberOrNull(i.venta),
    compra: toNumberOrNull(i.compra),
    apertura: toNumberOrNull(i.apertura),
    cierre: toNumberOrNull(i.cierre),
    historico: toNumberOrNull(i.historico),
    fecha: i.fecha ?? null,
    lastUpdate: i.lastUpdate ?? null,
    nextMonths: (i.nextMonths ?? []).map((m) => ({
      month: m.month,
      compra: toNumberOrNull(m.compra),
      venta: toNumberOrNull(m.venta),
      variacion: (() => {
        if (!m.variacion) return null;
        const s = String(m.variacion).replace("%", "");
        const n = Number(s.replace(",", "."));
        return Number.isFinite(n) ? n : s;
      })()
    }))
  };
}

function normalizeRaw(raw: unknown): DolarResponse {
  const parsed = RawSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error("Respuesta invalida del upstream");
  }

  return {
    panel: parsed.data.panel.map(normalizeItem),
    publicidades: parsed.data.publicidades
  };
}

function toPanelTitle(item: z.infer<typeof DolarApiItem>) {
  const key = (item.casa ?? item.nombre).toLowerCase();
  if (key.includes("blue")) return "Dólar Blue";
  if (key.includes("cripto")) return "Dólar Cripto";
  if (key.includes("oficial")) return "Dólar Oficial";
  if (key.includes("bolsa")) return "Dólar Bolsa";
  if (key.includes("contadoconliqui") || key.includes("contado con liqui")) {
    return "Dólar Contado con Liqui";
  }
  if (key.includes("mayorista")) return "Dólar Mayorista";
  if (key.includes("tarjeta")) return "Dólar Tarjeta";
  return item.nombre.startsWith("Dólar") ? item.nombre : `Dólar ${item.nombre}`;
}

function normalizePublicFallback(raw: unknown): DolarResponse {
  const parsed = DolarApiSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error("Respuesta invalida del fallback publico");
  }

  return {
    panel: parsed.data.map((item) => ({
      titulo: toPanelTitle(item),
      compra: item.compra ?? null,
      venta: item.venta ?? null,
      apertura: null,
      cierre: null,
      historico: null,
      fecha: item.fechaActualizacion ?? null,
      lastUpdate: item.fechaActualizacion ?? null,
      nextMonths: []
    })),
    publicidades: []
  };
}

async function fetchJson(
  url: string,
  options: {
    headers: Record<string, string>;
    revalidateSeconds?: number;
    signal?: AbortSignal;
    timeoutMs: number;
    maxRetries: number;
    retryAuthErrors: boolean;
  }
) {
  const res = await fetchWithRetry(
    url,
    {
      method: "GET",
      headers: options.headers,
      next: options.revalidateSeconds
        ? { revalidate: options.revalidateSeconds }
        : { revalidate: 60 },
      // @ts-ignore - agregamos timeoutMs custom para nuestro helper
      timeoutMs: options.timeoutMs,
      signal: options.signal
    },
    {
      retries: Math.max(0, options.maxRetries),
      baseDelayMs: 600,
      retryOn: (r, e) => {
        if (e) return true;
        if (!r) return true;
        if (!options.retryAuthErrors && (r.status === 401 || r.status === 403)) return false;
        if (r.status === 408 || r.status === 429) return true;
        if (r.status >= 500) return true;
        return false;
      }
    }
  );

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Upstream ${res.status} ${res.statusText}${txt ? ` - ${txt}` : ""}`);
  }

  return res.json();
}

export async function fetchDolarUpstream(options?: {
  signal?: AbortSignal;
  revalidateSeconds?: number;
  endpoint?: string;
  timeoutMs?: number;
  maxRetries?: number;
  useStaleOnError?: boolean;
}): Promise<DolarResponse> {
  const endpoint = options?.endpoint ?? process.env.DOLAR_API_ENDPOINT ?? DEFAULT_ENDPOINT;
  const timeoutMs = options?.timeoutMs ?? Number(process.env.DOLAR_API_TIMEOUT_MS || 15000);
  const maxRetries = options?.maxRetries ?? Number(process.env.DOLAR_API_MAX_RETRIES || 3);
  const useStaleOnError = options?.useStaleOnError ?? true;

  const headers: Record<string, string> = {
    Accept: "application/json, text/plain, */*",
    Origin: process.env.DOLAR_API_ORIGIN || "https://www.finanzasargy.com",
    Referer: process.env.DOLAR_API_REFERER || "https://www.finanzasargy.com/",
    "api-client": process.env.DOLAR_API_CLIENT || "finanzasargy",
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36",
  };

  try {
    let normalized: DolarResponse;

    try {
      const raw = await fetchJson(endpoint, {
        headers,
        revalidateSeconds: options?.revalidateSeconds,
        signal: options?.signal,
        timeoutMs,
        maxRetries,
        retryAuthErrors: false
      });
      normalized = normalizeRaw(raw);
    } catch (primaryError) {
      console.warn("[dolar] upstream principal fallo, probando fallback publico:", primaryError);
      const raw = await fetchJson(process.env.DOLAR_API_FALLBACK_ENDPOINT ?? PUBLIC_FALLBACK_ENDPOINT, {
        headers: { Accept: "application/json, text/plain, */*" },
        revalidateSeconds: options?.revalidateSeconds,
        signal: options?.signal,
        timeoutMs,
        maxRetries,
        retryAuthErrors: true
      });
      normalized = normalizePublicFallback(raw);
    }

    LAST_OK = normalized;
    LAST_OK_AT = Date.now();
    return normalized;
  } catch (err) {
    if (useStaleOnError && LAST_OK) {
      console.warn("[dolar] usando STALE por error upstream:", err);
      return LAST_OK;
    }
    throw err;
  }
}

export function getDolarCacheInfo() {
  return {
    hasStale: !!LAST_OK,
    ageMs: LAST_OK ? Date.now() - LAST_OK_AT : null
  };
}
