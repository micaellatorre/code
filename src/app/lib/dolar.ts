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

// normalizador
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
  } else {
    if (s.includes(",") && !s.includes(".")) {
      s = s.replace(/\./g, "").replace(",", ".");
    }
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
    nextMonths: (i.nextMonths ?? []).map(m => ({
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

// Cache en memoria para fallback (stale-on-error)
let LAST_OK: DolarResponse | null = null;
let LAST_OK_AT = 0;

export async function fetchDolarUpstream(options?: {
  signal?: AbortSignal;
  revalidateSeconds?: number;
  endpoint?: string;
  // control fino (opcional)
  timeoutMs?: number;
  maxRetries?: number;
  useStaleOnError?: boolean; // default true
}): Promise<DolarResponse> {
  const endpoint =
    options?.endpoint ??
    process.env.DOLAR_API_ENDPOINT ??
    "https://backend-ifa-production-a92c.up.railway.app/api/dolar/v2/general";

  const timeoutMs = options?.timeoutMs ?? Number(process.env.DOLAR_API_TIMEOUT_MS || 15000);
  const maxRetries = options?.maxRetries ?? Number(process.env.DOLAR_API_MAX_RETRIES || 3);
  const useStaleOnError = options?.useStaleOnError ?? true;

  // Headers opcionales (privado): Origin/Referer/Bearer/x-api-key
  const headers: Record<string, string> = {
    "Accept": "application/json, text/plain, */*",
    // Copiamos lo que viste en Network:
    "Origin": process.env.DOLAR_API_ORIGIN || "https://www.finanzasargy.com",
    "Referer": process.env.DOLAR_API_REFERER || "https://www.finanzasargy.com/",
    "api-client": process.env.DOLAR_API_CLIENT || "finanzasargy",
    // Un UA de navegador (algunos backends los filtran):
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36",
  };

  try {
    const res = await fetchWithRetry(
      endpoint,
      {
        method: "GET",
        headers,
        // hint a Next cache; la tolerancia real la maneja nuestro cache local
        next: options?.revalidateSeconds
          ? { revalidate: options.revalidateSeconds }
          : { revalidate: 60 },
        // @ts-ignore - agregamos timeoutMs custom para nuestro helper
        timeoutMs,
        signal: options?.signal
      },
      {
        retries: Math.max(0, maxRetries),
        baseDelayMs: 600,
        retryOn: (r, e) => {
          if (e) return true;                 // timeouts / red
          if (!r) return true;
          if (r.status === 401 || r.status === 403) return false; // no sirve reintentar
          if (r.status === 408 || r.status === 429) return true;
          if (r.status >= 500) return true;
          return false;
        }
      }
    );

    if (!res.ok) {
      // 401/403: probablemente falta header/token/origin
      const txt = await res.text().catch(() => "");
      throw new Error(`Upstream ${res.status} ${res.statusText}${txt ? ` – ${txt}` : ""}`);
    }

    const raw = await res.json();
    const parsed = RawSchema.safeParse(raw);
    if (!parsed.success) {
      throw new Error("Respuesta inválida del upstream");
    }

    const normalized: DolarResponse = {
      panel: parsed.data.panel.map(normalizeItem),
      publicidades: parsed.data.publicidades
    };

    // actualizar cache en memoria
    LAST_OK = normalized;
    LAST_OK_AT = Date.now();
    return normalized;

  } catch (err) {
    // fallback a stale si existe
    if (useStaleOnError && LAST_OK) {
      console.warn("[dolar] usando STALE por error upstream:", err);
      return LAST_OK;
    }
    throw err;
  }
}

// util para inspección del estado del cache (opcional)
export function getDolarCacheInfo() {
  return {
    hasStale: !!LAST_OK,
    ageMs: LAST_OK ? Date.now() - LAST_OK_AT : null
  };
}
