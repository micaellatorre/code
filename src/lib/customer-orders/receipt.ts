import type { CustomerOrderView } from "@/lib/domain/customer-orders"

function esc(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;")
}

function money(value: unknown) {
  const number = Number(value ?? 0)
  return `USD ${Number.isFinite(number) ? number.toFixed(2) : "0.00"}`
}

function date(value: unknown) {
  if (!value) return "-"
  const parsed = new Date(String(value))
  if (Number.isNaN(parsed.getTime())) return "-"
  return new Intl.DateTimeFormat("es-AR", { dateStyle: "medium" }).format(parsed)
}

function paymentMethodLabel(method: string) {
  const labels: Record<string, string> = {
    EFECTIVO_PESOS: "Efectivo ARS",
    EFECTIVO_USD: "Efectivo USD",
    TRANSFERENCIA_ARS: "Transferencia ARS",
    TRANSFERENCIA_USD: "Transferencia USD",
    TARJETA: "Tarjeta",
    BNA_CUOTAS: "BNA cuotas",
    USDT: "USDT",
    PLAN_CANJE: "Plan Canje",
  }
  return labels[method] ?? method
}

export function renderCustomerOrderReceiptHtml(order: CustomerOrderView) {
  const items = order.items.map((item) => `
    <tr>
      <td>${esc(item.descriptionSnapshot)}</td>
      <td class="num">${esc(item.quantity)}</td>
      <td class="num">${money(item.unitPriceUsd)}</td>
      <td class="num">${money(item.lineTotalUsd)}</td>
    </tr>`).join("")

  const payments = order.payments.length
    ? order.payments.map((payment) => `
      <tr>
        <td>${esc(paymentMethodLabel(payment.method))}</td>
        <td>${esc(payment.currency)} ${Number(payment.amount ?? 0).toFixed(2)}</td>
        <td class="num">${money(payment.coveredBaseUsd ?? payment.amountUsd ?? payment.amount)}</td>
      </tr>`).join("")
    : `<tr><td colspan="3">Sin pagos registrados</td></tr>`

  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>Pedido #${esc(order.orderNumber)}</title>
<style>
  body{font-family:Arial,sans-serif;color:#111;max-width:820px;margin:32px auto;padding:0 24px;line-height:1.35}
  h1{font-size:24px;margin-bottom:4px}.muted{color:#555}.grid{display:grid;grid-template-columns:1fr 1fr;gap:8px 28px;margin:24px 0}
  table{width:100%;border-collapse:collapse;margin:12px 0 24px}th,td{border-bottom:1px solid #ddd;padding:8px;text-align:left}.num{text-align:right}
  .totals{margin-left:auto;width:320px}.totals div{display:flex;justify-content:space-between;padding:4px 0}.balance{font-weight:700;font-size:18px}
  .notice{border:1px solid #bbb;border-radius:8px;padding:12px;margin:24px 0}.signature{margin-top:54px;display:grid;grid-template-columns:1fr 1fr;gap:60px}.line{border-top:1px solid #111;text-align:center;padding-top:6px}
  @media print{body{margin:0;max-width:none}.no-print{display:none}}
</style>
</head>
<body>
  <button class="no-print" onclick="window.print()">Imprimir</button>
  <h1>Comprobante de pedido #${esc(order.orderNumber)}</h1>
  <div class="muted">Fecha: ${date(order.requestedAt)} · Estado: ${esc(order.status)}</div>

  <div class="grid">
    <div><strong>Cliente:</strong> ${esc(order.customerNameSnapshot ?? `${order.buyer?.name ?? ""} ${order.buyer?.surname ?? ""}`.trim())}</div>
    <div><strong>DNI:</strong> ${esc(order.customerDocumentSnapshot ?? order.buyer?.dni)}</div>
    <div><strong>Teléfono:</strong> ${esc(order.customerPhoneSnapshot ?? order.buyer?.phone)}</div>
    <div><strong>Email:</strong> ${esc(order.customerEmailSnapshot ?? order.buyer?.email)}</div>
    <div><strong>Vendedor:</strong> ${esc(order.assignedSeller?.name ?? order.createdBy?.name ?? "-")}</div>
    <div><strong>Sucursal:</strong> ${esc(order.branch?.name ?? "-")}</div>
  </div>

  <h2>Productos</h2>
  <table><thead><tr><th>Descripción</th><th class="num">Cant.</th><th class="num">Unitario</th><th class="num">Total</th></tr></thead><tbody>${items}</tbody></table>

  <h2>Pagos</h2>
  <table><thead><tr><th>Medio</th><th>Importe pagado</th><th class="num">Cobertura USD base</th></tr></thead><tbody>${payments}</tbody></table>

  <div class="totals">
    <div><span>Total acordado</span><strong>${money(order.agreedTotalUsd)}</strong></div>
    <div><span>Pagado (USD base)</span><strong>${money(order.amountPaidUsd)}</strong></div>
    <div class="balance"><span>Saldo pendiente base</span><span>${money(order.balanceDueUsd)}</span></div>
    <div class="muted">El saldo se expresa a precio efectivo USD base. El importe final en otros medios se cotiza al momento del pago.</div>
  </div>

  <div class="notice">
    <strong>Entrega estimada:</strong> ${date(order.estimatedDeliveryAt)}<br />
    ${esc(order.deliveryDisclaimerSnapshot ?? "Fecha estimada sujeta a disponibilidad y logística.")}
  </div>

  ${order.notes ? `<p><strong>Observaciones:</strong> ${esc(order.notes)}</p>` : ""}

  <div class="signature">
    <div class="line">Firma del cliente</div>
    <div class="line">Aclaración / DNI</div>
  </div>
</body>
</html>`
}
