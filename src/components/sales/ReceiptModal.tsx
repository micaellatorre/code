"use client"

import ProductColorSwatch from "@/components/products/ProductColorSwatch"
import type { ReceiptPreview } from "./types"
import { buildReceiptViewModel } from "./receiptViewModel"

type ReceiptModalProps = {
  preview: ReceiptPreview | null
  onClose: () => void
}

const printableLogo = `
  <svg width="60" height="30" viewBox="0 0 60 30" fill="#10233f" xmlns="http://www.w3.org/2000/svg">
    <path d="M52.9051 0.169864C53.5247 0.174083 54.0903 0.524401 54.3719 1.07831L59.8256 11.8074C60.1293 12.4048 60.0462 13.1268 59.6149 13.6391L56.467 17.3776C55.0132 19.1042 52.8737 20.0982 50.6214 20.0935L39.8412 20.0709C38.8558 20.0688 37.9204 20.5064 37.2883 21.2651L34.1525 25.0293C34.1159 25.0732 34.0685 25.107 34.0151 25.1272L21.8445 29.7364C21.5245 29.8576 21.2532 29.4726 21.4736 29.2102L34.3083 13.9316C34.9377 13.1824 35.864 12.7494 36.8404 12.7479L51.1152 12.7261C52.0995 12.7246 53.0324 12.2846 53.6618 11.525L56.2871 8.35633C56.556 8.03167 56.3273 7.53927 55.9066 7.53733L40.4565 7.46611C40.1747 7.46482 40.0227 7.1339 40.2047 6.91797L45.4301 0.717513C45.7479 0.340395 46.2161 0.124323 46.7082 0.127674L52.9051 0.169864Z" />
    <path fill-rule="evenodd" clip-rule="evenodd" d="M33.3287 6.86922C33.0124 7.24555 32.5464 7.46212 32.0559 7.46077L13.5574 7.40976C12.6004 7.40712 11.6889 7.81922 11.0568 8.5403L3.69258 16.9407C3.41008 17.263 3.63725 17.7691 4.06492 17.7703L14.5701 17.7991C14.8644 17.7999 15.144 17.67 15.3338 17.4442L16.3762 16.2039C16.5582 15.9873 16.4048 15.6561 16.1225 15.6561L13.5029 15.6561C13.3899 15.6561 13.3286 15.5235 13.4015 15.4369L15.0543 13.4728C15.4331 13.0226 15.9906 12.7632 16.5777 12.7638L27.8692 12.7767C28.0667 12.777 28.1738 13.0088 28.0464 13.1602L18.5167 24.4932C18.2015 24.8682 17.7375 25.0845 17.2487 25.0845L7.68044 25.0846C7.0561 25.0846 6.48462 24.7328 6.20155 24.1743L0.189758 12.3128C-0.107083 11.7272 -0.0330145 11.021 0.378841 10.5102L4.82242 4.99902C7.35071 1.86327 11.1584 0.0460556 15.1776 0.0570848L38.2877 0.120503C38.5696 0.121277 38.7222 0.452076 38.5405 0.668309L33.3287 6.86922Z" />
  </svg>
`

function PrintableLogoMark({ className = "" }: { className?: string }) {
  return (
    <svg width="60" height="30" viewBox="0 0 60 30" className={className} xmlns="http://www.w3.org/2000/svg">
      <path d="M52.9051 0.169864C53.5247 0.174083 54.0903 0.524401 54.3719 1.07831L59.8256 11.8074C60.1293 12.4048 60.0462 13.1268 59.6149 13.6391L56.467 17.3776C55.0132 19.1042 52.8737 20.0982 50.6214 20.0935L39.8412 20.0709C38.8558 20.0688 37.9204 20.5064 37.2883 21.2651L34.1525 25.0293C34.1159 25.0732 34.0685 25.107 34.0151 25.1272L21.8445 29.7364C21.5245 29.8576 21.2532 29.4726 21.4736 29.2102L34.3083 13.9316C34.9377 13.1824 35.864 12.7494 36.8404 12.7479L51.1152 12.7261C52.0995 12.7246 53.0324 12.2846 53.6618 11.525L56.2871 8.35633C56.556 8.03167 56.3273 7.53927 55.9066 7.53733L40.4565 7.46611C40.1747 7.46482 40.0227 7.1339 40.2047 6.91797L45.4301 0.717513C45.7479 0.340395 46.2161 0.124323 46.7082 0.127674L52.9051 0.169864Z" />
      <path fillRule="evenodd" clipRule="evenodd" d="M33.3287 6.86922C33.0124 7.24555 32.5464 7.46212 32.0559 7.46077L13.5574 7.40976C12.6004 7.40712 11.6889 7.81922 11.0568 8.5403L3.69258 16.9407C3.41008 17.263 3.63725 17.7691 4.06492 17.7703L14.5701 17.7991C14.8644 17.7999 15.144 17.67 15.3338 17.4442L16.3762 16.2039C16.5582 15.9873 16.4048 15.6561 16.1225 15.6561L13.5029 15.6561C13.3899 15.6561 13.3286 15.5235 13.4015 15.4369L15.0543 13.4728C15.4331 13.0226 15.9906 12.7632 16.5777 12.7638L27.8692 12.7767C28.0667 12.777 28.1738 13.0088 28.0464 13.1602L18.5167 24.4932C18.2015 24.8682 17.7375 25.0845 17.2487 25.0845L7.68044 25.0846C7.0561 25.0846 6.48462 24.7328 6.20155 24.1743L0.189758 12.3128C-0.107083 11.7272 -0.0330145 11.021 0.378841 10.5102L4.82242 4.99902C7.35071 1.86327 11.1584 0.0460556 15.1776 0.0570848L38.2877 0.120503C38.5696 0.121277 38.7222 0.452076 38.5405 0.668309L33.3287 6.86922Z" />
    </svg>
  )
}

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
}

function safeCssColor(value: string | null | undefined) {
  return value && /^#[0-9a-fA-F]{6}$/.test(value) ? value : "#e5e7eb"
}

function getPrintableLogo(viewModel: ReturnType<typeof buildReceiptViewModel>) {
  const logoDataUrl = viewModel.brand.logoDataUrl
  if (logoDataUrl?.startsWith("data:image/")) {
    return `<img class="brand-image" src="${escapeHtml(logoDataUrl)}" alt="${escapeHtml(viewModel.brand.name)}" />`
  }

  return printableLogo
}

function optionalHtmlLine(label: string, value: string | null | undefined) {
  if (!value) return ""
  return `<div class="muted-line"><span>${escapeHtml(label)}:</span> ${escapeHtml(value)}</div>`
}

function phoneDetailsHtml(item: ReturnType<typeof buildReceiptViewModel>["items"][number]) {
  const details = item.phoneDetails
  if (!details) return ""
  const color = details.color.label
    ? `<span class="color-chip"><span class="swatch" style="background:${safeCssColor(details.color.swatchColor)}"></span>${escapeHtml(details.color.label)}</span>`
    : ""
  const lines = [
    details.imei ? `<div>IMEI: ${escapeHtml(details.imei)}</div>` : "",
    [details.battery ? `Batería: ${escapeHtml(details.battery)}` : "", details.capacity ? `Capacidad: ${escapeHtml(details.capacity)}` : "", color].filter(Boolean).join(" <span class=\"dot-sep\">&middot;</span> "),
  ].filter(Boolean)
  return lines.length ? `<div class="item-meta">${lines.join("")}</div>` : ""
}

function printReceipt(preview: ReceiptPreview) {
  const viewModel = buildReceiptViewModel(preview)
  const itemRows = viewModel.items
    .map((item) => `
      <tr>
        <td class="description ${item.depth > 0 ? "child-item" : ""}">
          ${item.depth > 0 ? '<div class="child-label">Accesorio incluido</div>' : ""}
          <div class="item-title">${escapeHtml(item.description)}</div>
          ${phoneDetailsHtml(item)}
        </td>
        <td class="quantity">${escapeHtml(item.quantity)}</td>
        <td class="money">${escapeHtml(item.unitPrice)}</td>
        <td class="money strong">${escapeHtml(item.lineTotal)}</td>
      </tr>
    `)
    .join("")

  const paymentRows = viewModel.payments
    .map((payment) => `
      <tr>
        <td>
          <div class="payment-method">${escapeHtml(payment.method)}</div>
          ${payment.details.map((detail) => `<div class="payment-detail">${escapeHtml(detail)}</div>`).join("")}
        </td>
        <td class="money">${escapeHtml(payment.originalAmount)}</td>
        <td class="money">${escapeHtml(payment.conversion)}</td>
        <td class="money strong">${escapeHtml(payment.equivalentUsd)}</td>
      </tr>
    `)
    .join("")

  const checkItems = viewModel.checks.map((item) => `<div><span class="check-box"></span>${escapeHtml(item)}</div>`).join("")

  const html = `
    <!doctype html>
    <html lang="es">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Comprobante ${escapeHtml(viewModel.operation.number)}</title>
        <style>
          @page { size: A4 portrait; margin: 10mm; }
          * { box-sizing: border-box; }
          html, body { margin: 0; padding: 0; background: #ffffff; color: #111827; font-family: Arial, Helvetica, sans-serif; font-size: 10px; line-height: 1.35; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          body { padding: 0; }
          .document { width: 190mm; min-height: 277mm; margin: 0 auto; border: 1px solid #6b7280; background: #ffffff; }
          .header { display: grid; grid-template-columns: minmax(0, 1.25fr) 44mm minmax(0, 1.15fr); border-bottom: 1px solid #6b7280; }
          .header > div { min-height: 31mm; padding: 4mm; }
          .header > div + div { border-left: 1px solid #9ca3af; }
          .brand-image { display: block; max-width: 42mm; max-height: 13mm; object-fit: contain; }
          .brand-name { margin-top: 2mm; color: #10233f; font-size: 12px; font-weight: 700; text-transform: uppercase; }
          .muted-line { margin-top: 0.7mm; color: #4b5563; font-size: 9px; overflow-wrap: anywhere; }
          .muted-line span, .label { color: #6b7280; font-size: 8px; font-weight: 700; text-transform: uppercase; }
          .doc-title { display: flex; height: 100%; align-items: center; justify-content: center; color: #111827; font-size: 16px; font-weight: 800; line-height: 1.05; text-align: center; text-transform: uppercase; }
          .meta-grid { display: grid; grid-template-columns: 24mm minmax(0, 1fr); gap: 1mm 2mm; }
          .value { font-weight: 600; overflow-wrap: anywhere; }
          .section { border-bottom: 1px solid #9ca3af; padding: 3mm 4mm; }
          .section-title { margin-bottom: 2mm; color: #111827; font-size: 9px; font-weight: 800; text-transform: uppercase; }
          .buyer-grid { display: grid; grid-template-columns: 2fr 1fr 1fr 1fr; gap: 2mm 5mm; }
          table { width: 100%; border-collapse: collapse; table-layout: fixed; }
          col.desc { width: auto; } col.qty { width: 14mm; } col.price { width: 31mm; } col.amount { width: 31mm; }
          thead { display: table-header-group; }
          th { border: 1px solid #9ca3af; background: #f3f4f6; padding: 1.8mm 2mm; color: #374151; font-size: 8px; text-align: right; text-transform: uppercase; }
          th:first-child { text-align: left; }
          td { border: 1px solid #d1d5db; padding: 2mm; vertical-align: top; }
          tr { break-inside: avoid; }
          .description { overflow-wrap: anywhere; }
          .child-item { padding-left: 7mm; color: #374151; }
          .child-label { color: #6b7280; font-size: 7.5px; font-weight: 700; text-transform: uppercase; }
          .item-title, .payment-method { font-weight: 700; }
          .item-meta, .payment-detail { margin-top: 0.8mm; color: #4b5563; font-size: 8.5px; }
          .swatch { display: inline-block; width: 8px; height: 8px; margin-right: 3px; border: 1px solid #6b7280; border-radius: 999px; vertical-align: -1px; }
          .color-chip { white-space: nowrap; }
          .quantity { text-align: center; white-space: nowrap; }
          .money { text-align: right; white-space: nowrap; }
          .strong { font-weight: 800; }
          .total-row { display: grid; grid-template-columns: minmax(0, 1fr) 42mm; align-items: center; border-top: 0; background: #f9fafb; }
          .total-row div { padding: 3mm 4mm; border-top: 1px solid #6b7280; }
          .total-label { color: #111827; font-size: 10px; font-weight: 800; text-align: right; text-transform: uppercase; }
          .total-value { border-left: 1px solid #9ca3af; font-size: 15px; font-weight: 900; text-align: right; white-space: nowrap; }
          .payments col.method { width: auto; } .payments col.native { width: 35mm; } .payments col.conversion { width: 39mm; } .payments col.usd { width: 29mm; }
          .control-equipo, .warranty, .signatures { break-inside: avoid; }
          .checks { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1.6mm 6mm; font-size: 9.5px; }
          .check-box { display: inline-block; width: 9px; height: 9px; margin-right: 5px; border: 1px solid #111827; vertical-align: -1px; }
          .warranty-text { white-space: pre-wrap; overflow-wrap: anywhere; font-size: 9px; }
          .signature-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 18mm; padding-top: 9mm; }
          .signature-line { border-top: 1px solid #111827; padding-top: 1.5mm; text-align: center; }
          .signature-name { margin-top: 0.8mm; color: #4b5563; font-size: 8.5px; }
          .footer { padding: 2.5mm 4mm; color: #6b7280; font-size: 8px; text-align: center; }
          @media screen { body { padding: 12mm 0; background: #e5e7eb; } .document { box-shadow: 0 12px 40px rgba(15, 23, 42, 0.18); } }
          @media print { html, body { width: 210mm; min-height: 297mm; } .document { width: 190mm; min-height: auto; box-shadow: none; } }
        </style>
      </head>
      <body>
        <main class="document">
          <header class="header">
            <div>
              ${getPrintableLogo(viewModel)}
              <div class="brand-name">${escapeHtml(viewModel.brand.name)}</div>
              ${optionalHtmlLine("Sucursal", viewModel.branch.name)}
              ${optionalHtmlLine("Teléfono", viewModel.branch.phone)}
              ${optionalHtmlLine("Dirección", [viewModel.branch.address, viewModel.branch.city].filter(Boolean).join(", ") || null)}
              ${optionalHtmlLine("Email", viewModel.branch.email)}
            </div>
            <div><div class="doc-title">Comprobante<br />de venta</div></div>
            <div class="meta-grid">
              <div class="label">N.º comprobante</div><div class="value">${escapeHtml(viewModel.operation.number)}</div>
              <div class="label">Fecha</div><div class="value">${escapeHtml(viewModel.operation.date)}</div>
              <div class="label">Hora</div><div class="value">${escapeHtml(viewModel.operation.time)}</div>
              <div class="label">Vendedor</div><div class="value">${escapeHtml(viewModel.operation.seller ?? "-")}</div>
            </div>
          </header>

          <section class="section">
            <div class="section-title">Datos del comprador</div>
            <div class="buyer-grid">
              <div><div class="label">Nombre y apellido</div><div class="value">${escapeHtml(viewModel.buyer.fullName)}</div></div>
              <div><div class="label">Tipo</div><div class="value">${escapeHtml(viewModel.buyer.type)}</div></div>
              <div><div class="label">Teléfono</div><div class="value">${escapeHtml(viewModel.buyer.phone ?? "-")}</div></div>
              <div><div class="label">Documento</div><div class="value">${escapeHtml(viewModel.buyer.cuit ?? viewModel.buyer.dni ?? "-")}</div></div>
            </div>
          </section>

          <section class="section">
            <div class="section-title">Detalle de la venta</div>
            <table>
              <colgroup><col class="desc" /><col class="qty" /><col class="price" /><col class="amount" /></colgroup>
              <thead><tr><th>Descripción</th><th>Cant.</th><th>Precio unit. USD</th><th>Importe USD</th></tr></thead>
              <tbody>${itemRows}</tbody>
            </table>
            <div class="total-row"><div class="total-label">Total de la operación</div><div class="total-value">${escapeHtml(viewModel.operation.total)}</div></div>
          </section>

          ${paymentRows ? `
            <section class="section">
              <div class="section-title">Medios de pago</div>
              <table class="payments">
                <colgroup><col class="method" /><col class="native" /><col class="conversion" /><col class="usd" /></colgroup>
                <thead><tr><th>Medio de pago</th><th>Monto original</th><th>Conversión aplicada</th><th>Equiv. USD</th></tr></thead>
                <tbody>${paymentRows}</tbody>
              </table>
            </section>
          ` : ""}

          <section class="section control-equipo">
            <div class="section-title">Control de equipo</div>
            <div class="checks">${checkItems}</div>
          </section>

          <section class="section warranty">
            <div class="section-title">Garantía</div>
            <div class="warranty-text">${escapeHtml(viewModel.brand.warrantyPolicyText || "-")}</div>
          </section>

          <section class="section signatures">
            <div class="section-title">Firmas</div>
            <div class="signature-grid">
              <div class="signature-line">Firma / Aclaración del cliente</div>
              <div class="signature-line">Firma / Aclaración del local</div>
            </div>
          </section>

          <footer class="footer"><strong>${escapeHtml(viewModel.brand.name)}</strong> - ${escapeHtml(viewModel.footer)}</footer>
        </main>
        <script>
          window.addEventListener("load", function () {
            window.focus();
            window.setTimeout(function () { window.print(); }, 250);
          });
        </script>
      </body>
    </html>
  `

  const popup = window.open("", "_blank", "width=960,height=800")

  if (!popup) {
    window.alert("El navegador bloqueo la ventana de impresion. Habilita las ventanas emergentes para generar el comprobante.")
    return
  }

  popup.document.open()
  popup.document.write(html)
  popup.document.close()
}

function LabeledValue({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null
  return (
    <div>
      <div className="text-[10px] font-bold uppercase text-base-content/55">{label}</div>
      <div className="font-semibold text-base-content">{value}</div>
    </div>
  )
}

export default function ReceiptModal({ preview, onClose }: ReceiptModalProps) {
  if (!preview) return null

  const viewModel = buildReceiptViewModel(preview)

  return (
    <dialog className="modal modal-open">
      <div className="modal-box max-w-5xl rounded-lg">
        <div className="mx-auto max-w-[210mm] border border-gray-500 bg-white text-[10px] leading-snug text-gray-900">
          <header className="grid grid-cols-[minmax(0,1.25fr)_150px_minmax(0,1.15fr)] border-b border-gray-500 max-md:grid-cols-1">
            <div className="min-h-28 border-gray-400 p-4 max-md:border-b md:border-r">
              <div className="text-[#10233f]">
                {viewModel.brand.logoDataUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={viewModel.brand.logoDataUrl} alt={viewModel.brand.name} className="max-h-14 max-w-44 object-contain" />
                ) : (
                  <PrintableLogoMark className="fill-current" />
                )}
              </div>
              <div className="mt-2 text-xs font-extrabold uppercase text-[#10233f]">{viewModel.brand.name}</div>
              <div className="mt-1 space-y-0.5 text-[10px] text-gray-600">
                {viewModel.branch.name ? <div><span className="font-bold uppercase text-gray-500">Sucursal:</span> {viewModel.branch.name}</div> : null}
                {viewModel.branch.phone ? <div><span className="font-bold uppercase text-gray-500">Teléfono:</span> {viewModel.branch.phone}</div> : null}
                {viewModel.branch.address || viewModel.branch.city ? <div><span className="font-bold uppercase text-gray-500">Dirección:</span> {[viewModel.branch.address, viewModel.branch.city].filter(Boolean).join(", ")}</div> : null}
                {viewModel.branch.email ? <div><span className="font-bold uppercase text-gray-500">Email:</span> {viewModel.branch.email}</div> : null}
              </div>
            </div>
            <div className="flex items-center justify-center border-gray-400 p-4 text-center text-lg font-black uppercase leading-none max-md:border-b md:border-r">
              Comprobante<br />de venta
            </div>
            <div className="grid grid-cols-[116px_minmax(0,1fr)] gap-x-3 gap-y-1 p-4">
              <div className="text-[10px] font-bold uppercase text-gray-500">N.º comprobante</div><div className="font-semibold">{viewModel.operation.number}</div>
              <div className="text-[10px] font-bold uppercase text-gray-500">Fecha</div><div className="font-semibold">{viewModel.operation.date}</div>
              <div className="text-[10px] font-bold uppercase text-gray-500">Hora</div><div className="font-semibold">{viewModel.operation.time}</div>
              <div className="text-[10px] font-bold uppercase text-gray-500">Sucursal</div><div className="font-semibold">{viewModel.branch.name ?? "-"}</div>
              <div className="text-[10px] font-bold uppercase text-gray-500">Vendedor</div><div className="font-semibold">{viewModel.operation.seller ?? "-"}</div>
            </div>
          </header>

          <section className="border-b border-gray-400 p-4">
            <div className="mb-2 text-[11px] font-extrabold uppercase">Datos del comprador</div>
            <div className="grid grid-cols-[2fr_1fr_1fr_1fr] gap-4 max-sm:grid-cols-1">
              <LabeledValue label="Nombre y apellido" value={viewModel.buyer.fullName} />
              <LabeledValue label="Tipo" value={viewModel.buyer.type} />
              <LabeledValue label="Teléfono" value={viewModel.buyer.phone ?? "-"} />
              <LabeledValue label="Documento" value={viewModel.buyer.cuit ?? viewModel.buyer.dni ?? "-"} />
            </div>
          </section>

          <section className="border-b border-gray-400 p-4">
            <div className="mb-2 text-[11px] font-extrabold uppercase">Detalle de la venta</div>
            <div className="overflow-x-auto">
              <table className="w-full table-fixed border-collapse">
                <colgroup><col /><col className="w-14" /><col className="w-32" /><col className="w-32" /></colgroup>
                <thead>
                  <tr className="bg-gray-100 text-[10px] uppercase text-gray-700">
                    <th className="border border-gray-400 px-2 py-1.5 text-left">Descripción</th>
                    <th className="border border-gray-400 px-2 py-1.5 text-center">Cant.</th>
                    <th className="border border-gray-400 px-2 py-1.5 text-right">Precio unit. USD</th>
                    <th className="border border-gray-400 px-2 py-1.5 text-right">Importe USD</th>
                  </tr>
                </thead>
                <tbody>
                  {viewModel.items.map((item) => (
                    <tr key={item.id}>
                      <td className={`border border-gray-300 px-2 py-1.5 align-top ${item.depth > 0 ? "pl-7 text-gray-700" : ""}`}>
                        {item.depth > 0 ? <div className="text-[9px] font-bold uppercase text-gray-500">Accesorio incluido</div> : null}
                        <div className="font-bold">{item.description}</div>
                        {item.phoneDetails ? (
                          <div className="mt-1 text-[10px] text-gray-600">
                            {item.phoneDetails.imei ? <div>IMEI: {item.phoneDetails.imei}</div> : null}
                            <div className="flex flex-wrap items-center gap-x-1.5">
                              {item.phoneDetails.battery ? <span>Batería: {item.phoneDetails.battery}</span> : null}
                              {item.phoneDetails.capacity ? <span>Capacidad: {item.phoneDetails.capacity}</span> : null}
                              {item.phoneDetails.color.label ? (
                                <span className="inline-flex items-center gap-1">
                                  <ProductColorSwatch hexColor={item.phoneDetails.color.swatchColor} title={item.phoneDetails.color.label} />
                                  {item.phoneDetails.color.label}
                                </span>
                              ) : null}
                            </div>
                          </div>
                        ) : null}
                      </td>
                      <td className="border border-gray-300 px-2 py-1.5 text-center align-top">{item.quantity}</td>
                      <td className="border border-gray-300 px-2 py-1.5 text-right align-top">{item.unitPrice}</td>
                      <td className="border border-gray-300 px-2 py-1.5 text-right align-top font-extrabold">{item.lineTotal}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="grid grid-cols-[minmax(0,1fr)_170px] border-x border-b border-gray-500 bg-gray-50">
              <div className="px-4 py-3 text-right text-[11px] font-extrabold uppercase">Total de la operación</div>
              <div className="border-l border-gray-400 px-4 py-3 text-right text-base font-black">{viewModel.operation.total}</div>
            </div>
          </section>

          {viewModel.payments.length ? (
            <section className="border-b border-gray-400 p-4">
              <div className="mb-2 text-[11px] font-extrabold uppercase">Medios de pago</div>
              <div className="overflow-x-auto">
                <table className="w-full table-fixed border-collapse">
                  <colgroup><col /><col className="w-36" /><col className="w-40" /><col className="w-32" /></colgroup>
                  <thead>
                    <tr className="bg-gray-100 text-[10px] uppercase text-gray-700">
                      <th className="border border-gray-400 px-2 py-1.5 text-left">Medio de pago</th>
                      <th className="border border-gray-400 px-2 py-1.5 text-right">Monto original</th>
                      <th className="border border-gray-400 px-2 py-1.5 text-right">Conversión aplicada</th>
                      <th className="border border-gray-400 px-2 py-1.5 text-right">Equiv. USD</th>
                    </tr>
                  </thead>
                  <tbody>
                    {viewModel.payments.map((payment) => (
                      <tr key={payment.id}>
                        <td className="border border-gray-300 px-2 py-1.5 align-top">
                          <div className="font-bold">{payment.method}</div>
                          {payment.details.map((detail) => <div key={detail} className="mt-0.5 text-[10px] text-gray-600">{detail}</div>)}
                        </td>
                        <td className="border border-gray-300 px-2 py-1.5 text-right align-top">{payment.originalAmount}</td>
                        <td className="border border-gray-300 px-2 py-1.5 text-right align-top">{payment.conversion}</td>
                        <td className="border border-gray-300 px-2 py-1.5 text-right align-top font-extrabold">{payment.equivalentUsd}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}

          <section className="break-inside-avoid border-b border-gray-400 p-4">
            <div className="mb-2 text-[11px] font-extrabold uppercase">Control de equipo</div>
            <div className="grid grid-cols-3 gap-x-8 gap-y-2 text-[11px] max-sm:grid-cols-1">
              {viewModel.checks.map((item) => (
                <div key={item}><span className="mr-2 inline-block size-2.5 border border-gray-900 align-[-1px]" />{item}</div>
              ))}
            </div>
          </section>

          <section className="break-inside-avoid border-b border-gray-400 p-4">
            <div className="mb-2 text-[11px] font-extrabold uppercase">Garantía</div>
            <div className="whitespace-pre-wrap break-words text-[10px]">{viewModel.brand.warrantyPolicyText || "-"}</div>
          </section>

          <section className="break-inside-avoid border-b border-gray-400 p-4">
            <div className="mb-8 text-[11px] font-extrabold uppercase">Firmas</div>
            <div className="grid grid-cols-2 gap-16 max-sm:grid-cols-1">
              <div className="border-t border-gray-900 pt-1 text-center">Firma / Aclaración del cliente</div>
              <div className="border-t border-gray-900 pt-1 text-center">Firma / Aclaración del local</div>
            </div>
          </section>

          <footer className="p-3 text-center text-[10px] text-gray-600">
            <strong>{viewModel.brand.name}</strong> - {viewModel.footer}
          </footer>
        </div>

        <div className="modal-action">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cerrar
          </button>
          <button type="button" className="btn btn-primary" onClick={() => printReceipt(preview)}>
            Imprimir
          </button>
        </div>
      </div>
    </dialog>
  )
}
