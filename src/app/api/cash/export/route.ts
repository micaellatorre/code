import { NextResponse } from "next/server"
import { UserRole } from "@prisma/client"
import { z } from "zod"
import { requireRoleApi } from "@/lib/auth/auth"
import { formatCashAmount, formatUsdEquivalent, getCashMovements } from "@/lib/domain/cash"
import { resolveSessionTenantId } from "@/lib/tenant"

const requestSchema = z.object({
  from: z.string().min(10),
  to: z.string().min(10),
  accountId: z.string().optional().nullable(),
  direction: z.enum(["INCOME", "EXPENSE"]).optional().nullable(),
})

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

function buildReport(params: { rows: any[]; from: string; to: string; reporter: string; branch: string }) {
  const incomeUsd = params.rows.reduce((sum, row) => row.direction === "INCOME" ? sum + (row.amountUsd ?? (row.currency === "USD" || row.currency === "USDT" ? row.amount : 0)) : sum, 0)
  const expenseUsd = params.rows.reduce((sum, row) => row.direction === "EXPENSE" ? sum + (row.amountUsd ?? (row.currency === "USD" || row.currency === "USDT" ? row.amount : 0)) : sum, 0)
  const rows = params.rows.map((row) => `
    <tr>
      <td>${escapeHtml(new Date(row.occurredAt).toLocaleString("es-AR"))}</td>
      <td>${escapeHtml(row.directionLabel)}</td>
      <td>${escapeHtml(row.categoryLabel)}</td>
      <td>${escapeHtml(row.detail)}</td>
      <td>${escapeHtml(row.account?.name)}</td>
      <td>${escapeHtml(formatCashAmount({ amount: row.amount, currency: row.currency, direction: row.direction }))}</td>
      <td>${escapeHtml(row.currency)}</td>
      <td>${escapeHtml(row.exchangeRate ?? "-")}</td>
      <td>${escapeHtml(formatUsdEquivalent(row.amountUsd, row.direction))}</td>
    </tr>`).join("")
  return `<!doctype html>
  <html>
    <head>
      <meta charset="utf-8" />
      <title>Caja</title>
      <style>
        body{font-family:Arial,sans-serif;color:#111827;padding:28px}
        header{border-bottom:1px solid #d1d5db;margin-bottom:18px;padding-bottom:12px}
        h1{margin:0;font-size:24px} p{margin:4px 0;color:#4b5563;font-size:12px}
        .summary{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:16px 0}
        .box{border:1px solid #d1d5db;border-radius:8px;padding:8px}.box span{display:block;color:#6b7280;font-size:10px;text-transform:uppercase}.box strong{font-size:16px}
        table{width:100%;border-collapse:collapse} th,td{border:1px solid #e5e7eb;padding:6px;font-size:10px;text-align:left;vertical-align:top} th{background:#f3f4f6}
        @media print{@page{margin:14mm} body{padding:0}}
      </style>
    </head>
    <body>
      <header>
        <h1>GP Importaciones / Caja</h1>
        <p>Sucursal: ${escapeHtml(params.branch)} - Periodo: ${escapeHtml(params.from)} - ${escapeHtml(params.to)}</p>
        <p>Generado por: ${escapeHtml(params.reporter)} - Fecha: ${escapeHtml(new Date().toLocaleString("es-AR"))}</p>
      </header>
      <div class="summary">
        <div class="box"><span>Ingresos USD EQV</span><strong>${escapeHtml(formatUsdEquivalent(incomeUsd, "INCOME"))}</strong></div>
        <div class="box"><span>Egresos USD EQV</span><strong>${escapeHtml(formatUsdEquivalent(expenseUsd, "EXPENSE"))}</strong></div>
        <div class="box"><span>Flujo neto USD EQV</span><strong>${escapeHtml(formatUsdEquivalent(incomeUsd - expenseUsd))}</strong></div>
      </div>
      <table>
        <thead><tr><th>Fecha/Hora</th><th>Tipo</th><th>Categoria</th><th>Detalle</th><th>Caja</th><th>Monto</th><th>Moneda</th><th>TC</th><th>Eqv. USD</th></tr></thead>
        <tbody>${rows || `<tr><td colspan="9">Sin movimientos</td></tr>`}</tbody>
      </table>
    </body>
  </html>`
}

export async function POST(request: Request) {
  const auth = await requireRoleApi(["ADMIN", "SOCIO"])
  if (!auth.ok) return Response.json({ error: "Unauthorized" }, { status: auth.status })
  const parsed = requestSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: "Payload invalido" }, { status: 400 })
  const tenantId = await resolveSessionTenantId(auth.session.user.tenantId)
  if (!tenantId) return NextResponse.json({ error: "Tenant no disponible" }, { status: 403 })

  const firstPage = await getCashMovements({
    tenantId,
    actorUserId: auth.session.user.id,
    actorRole: auth.session.user.activeRole as UserRole,
    query: { ...parsed.data, page: 1, pageSize: 100 },
  })
  const rows = [...firstPage.items]
  for (let page = 2; page <= firstPage.pagination.pages; page += 1) {
    const next = await getCashMovements({
      tenantId,
      actorUserId: auth.session.user.id,
      actorRole: auth.session.user.activeRole as UserRole,
      query: { ...parsed.data, page, pageSize: 100 },
    })
    rows.push(...next.items)
  }
  return new NextResponse(buildReport({
    rows,
    from: parsed.data.from,
    to: parsed.data.to,
    branch: firstPage.filtersMeta.branch.name,
    reporter: auth.session.user.name || auth.session.user.email || "Usuario autenticado",
  }), { headers: { "Content-Type": "text/html; charset=utf-8" } })
}
