import { NextResponse } from "next/server"
import * as XLSX from "xlsx"
import { z } from "zod"
import { requireRoleApi } from "@/lib/auth/auth"
import { resolveSessionTenantId } from "@/lib/tenant"
import {
  getDatabaseReadModel,
  resolveDatabaseDateRange,
  type DatabaseReadModel,
  type DatabaseTabKey,
} from "@/lib/database/read-models"
import { databaseTabLabels } from "@/lib/database/config"

export const dynamic = "force-dynamic"

const exportFields = ["cash", "retail", "wholesale", "purchases", "reservations", "service", "audit", "buyers"] as const

const requestSchema = z.object({
  format: z.enum(["pdf", "xlsx"]),
  from: z.string().min(10),
  to: z.string().min(10),
  fields: z.array(z.enum(exportFields)).min(1),
})

function sheetName(field: DatabaseTabKey) {
  const names: Record<string, string> = {
    cash: "Caja",
    retail: "Ventas Minoristas",
    wholesale: "Ventas Mayoristas",
    purchases: "Compras Proveedores",
    reservations: "Guardados Reservas",
    service: "Servicio Tecnico",
    audit: "Trazabilidad",
    buyers: "Compradores",
  }
  return names[field] ?? databaseTabLabels[field]
}

function flattenRows(model: DatabaseReadModel, field: (typeof exportFields)[number]) {
  if (field === "cash") {
    return model.cash.map((row) => ({
      Fecha: row.date,
      Detalle: row.detail,
      Monto: row.amount,
      Moneda: row.currency,
      Caja: row.account,
      Cotizacion: row.exchangeRate,
      "Equivalente USD": row.amountUsd,
      Tipo: row.type,
      Fuente: row.source,
    }))
  }

  if (field === "retail") {
    return model.retail.map((row) => ({
      Fecha: row.date,
      Sucursal: row.branch,
      Cliente: row.customer,
      Item: row.itemSummary,
      IMEI: row.itemMeta,
      Total: row.total,
      Abonado: row.amountPaid,
      Deuda: row.balanceDue,
      "Costo total": row.costTotal,
      Margen: row.profit,
      Estado: row.status,
      "Estado financiero": row.financialStatus,
      Vendedor: row.seller,
    }))
  }

  if (field === "wholesale") {
    return model.wholesale.map((row) => ({
      Fecha: row.date,
      Sucursal: row.branch,
      Cliente: row.customer,
      Item: row.itemSummary,
      IMEI: row.itemMeta,
      "Precio acordado": row.agreedPrice,
      "Monto original": row.originalAmount,
      "Abonado USD": row.paidUsd,
      "Costo total": row.costTotal,
      Margen: row.profit,
      Deuda: row.balanceDue,
      Vendedor: row.seller,
    }))
  }

  if (field === "purchases") {
    return model.purchases.map((row) => ({
      Fecha: row.date,
      Proveedor: row.supplier,
      "Provincia proveedor": row.supplierProvince,
      "Ciudad proveedor": row.supplierCity,
      Modelo: row.model,
      "IMEI / Serie": row.imeiSerial,
      Codigo: row.code,
      Total: row.total,
      Moneda: row.currency,
      Abonado: row.amountPaid,
      Cantidad: row.quantity,
      Deuda: row.debt,
    }))
  }

  if (field === "reservations") {
    return model.reservations.map((row) => ({
      Fecha: row.reservedAt,
      Cliente: row.customer,
      Item: row.item,
      "Cuando pasa": row.pickupAt,
      "Precio acordado": row.agreedPrice,
      "Sena USD": row.depositUsd,
      Regalos: row.gifts,
      Estado: row.status,
      Fuente: row.source,
    }))
  }

  if (field === "service") {
    return model.service.map((row) => ({
      Fecha: row.date,
      Tipo: row.type,
      "Cliente / Equipo": row.customerEquipment,
      "Modelo / Falla": row.modelFailure,
      Tecnico: row.technician,
      Precio: row.priceAmount,
      Costo: row.costAmount,
      Moneda: row.currency,
      Estado: row.status,
    }))
  }

  if (field === "buyers") {
    return model.buyers.map((row) => ({
      Nombre: row.name,
      Tipo: row.type,
      Provincia: row.province,
      "Sucursal de registro": row.registeredBranch,
      Instagram: row.instagram,
      Telefono: row.phone,
      "Ultima compra": row.lastPurchaseAt,
      Operaciones: row.operations,
      "Total comprado": row.totalPurchased,
      Saldo: row.balanceDue,
    }))
  }

  return model.audit.map((row) => ({
    Fecha: row.date,
    Accion: row.action,
    Modulo: row.module,
    Detalle: row.detail,
    Usuario: row.user,
  }))
}

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

function buildHtmlReport(params: {
  model: DatabaseReadModel
  fields: Array<(typeof exportFields)[number]>
  rangeLabel: string
  reporter: string
}) {
  const sections = params.fields
    .map((field) => {
      const rows = flattenRows(params.model, field)
      const headers = Object.keys(rows[0] ?? { Estado: "Sin registros" })
      return `
        <section>
          <h2>${escapeHtml(sheetName(field))}</h2>
          <table>
            <thead><tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("")}</tr></thead>
            <tbody>
              ${
                rows.length
                  ? rows.map((row) => `<tr>${headers.map((header) => `<td>${escapeHtml(row[header as keyof typeof row])}</td>`).join("")}</tr>`).join("")
                  : `<tr><td colspan="${headers.length}">Sin registros</td></tr>`
              }
            </tbody>
          </table>
        </section>`
    })
    .join("")

  return `<!doctype html>
  <html>
    <head>
      <meta charset="utf-8" />
      <title>Base de Datos</title>
      <style>
        body{font-family:Arial,sans-serif;color:#111827;padding:28px}
        header{border-bottom:1px solid #d1d5db;margin-bottom:20px;padding-bottom:12px}
        h1{margin:0;font-size:24px} h2{margin:22px 0 8px;font-size:16px}
        p{margin:4px 0;color:#4b5563;font-size:12px}
        .kpis{display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin:16px 0}
        .kpi{border:1px solid #d1d5db;border-radius:8px;padding:8px}
        .kpi span{display:block;color:#6b7280;font-size:10px;text-transform:uppercase}
        .kpi strong{font-size:16px}
        table{width:100%;border-collapse:collapse;page-break-inside:auto}
        tr{page-break-inside:avoid;page-break-after:auto}
        th,td{border:1px solid #e5e7eb;padding:6px;font-size:10px;text-align:left;vertical-align:top}
        th{background:#f3f4f6}
        @media print{@page{margin:14mm} body{padding:0}}
      </style>
    </head>
    <body>
      <header>
        <h1>Base de Datos</h1>
        <p>Reportes financieros y trazabilidad</p>
        <p>Periodo: ${escapeHtml(params.rangeLabel)} · Responsable: ${escapeHtml(params.reporter)} · Generado: ${escapeHtml(new Date().toLocaleString("es-AR"))}</p>
      </header>
      <div class="kpis">
        <div class="kpi"><span>Ventas totales</span><strong>${params.model.kpis.totalSales.toFixed(2)}</strong></div>
        <div class="kpi"><span>Margen minorista</span><strong>${params.model.kpis.retailMargin?.toFixed(2) ?? "Restringido"}</strong></div>
        <div class="kpi"><span>Margen mayorista</span><strong>${params.model.kpis.wholesaleMargin?.toFixed(2) ?? "Restringido"}</strong></div>
        <div class="kpi"><span>Margen servicio</span><strong>${params.model.kpis.serviceMargin?.toFixed(2) ?? "Restringido"}</strong></div>
        <div class="kpi"><span>Margen bruto</span><strong>${params.model.kpis.grossMarginPct?.toFixed(1) ?? "Restringido"}%</strong></div>
      </div>
      ${sections}
    </body>
  </html>`
}

export async function POST(request: Request) {
  const auth = await requireRoleApi(["ADMIN", "SOCIO", "VENDEDOR", "STOCK"])
  if (!auth.ok) {
    return NextResponse.json({ error: "Unauthorized" }, { status: auth.status })
  }

  const parsed = requestSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: "Payload invalido" }, { status: 400 })
  }

  const tenantId = await resolveSessionTenantId(auth.session.user.tenantId)
  if (!tenantId) {
    return NextResponse.json({ error: "Tenant no disponible" }, { status: 403 })
  }

  const range = resolveDatabaseDateRange("custom", parsed.data.from, parsed.data.to)
  const model = await getDatabaseReadModel({
    tenantId,
    range,
    role: auth.session.user.activeRole,
  })
  const reporter = auth.session.user.name || auth.session.user.email || "Usuario autenticado"

  if (parsed.data.format === "pdf") {
    return new NextResponse(buildHtmlReport({ model, fields: parsed.data.fields, rangeLabel: range.label, reporter }), {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    })
  }

  const workbook = XLSX.utils.book_new()
  for (const field of parsed.data.fields) {
    const rows = flattenRows(model, field)
    const sheet = XLSX.utils.json_to_sheet(rows.length ? rows : [{ Estado: "Sin registros" }])
    XLSX.utils.book_append_sheet(workbook, sheet, sheetName(field).slice(0, 31))
  }

  const buffer = XLSX.write(workbook, { bookType: "xlsx", type: "buffer" }) as Buffer
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="base-de-datos-${parsed.data.from}-${parsed.data.to}.xlsx"`,
    },
  })
}
