// src/app/api/dolar/route.ts
export const runtime = "edge";
import { NextResponse } from "next/server";
import { fetchDolarUpstream, getDolarCacheInfo } from "@/app/lib/dolar";

export async function GET() {
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
