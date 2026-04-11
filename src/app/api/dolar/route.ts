// src/app/api/dolar/route.ts
export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { fetchDolarUpstream, getDolarCacheInfo } from "@/app/lib/dolar";
import { requireRoleApi } from "@/lib/auth/auth";

export async function GET() {
  const auth = await requireRoleApi(["ADMIN", "VENDEDOR", "STOCK", "SOCIO"])

  if (!auth.ok) {
    return Response.json({ error: "Unauthorized" }, { status: auth.status })
  }

  try {
    const data = await fetchDolarUpstream({ revalidateSeconds: 60, useStaleOnError: true });
    const cache = getDolarCacheInfo();
    return NextResponse.json(
      { ok: true, data, cache },
      { status: 200, headers: { "Cache-Control": "s-maxage=60, stale-while-revalidate=30" } }
    );
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? "error" },
      { status: 502 }
    );
  }
}
