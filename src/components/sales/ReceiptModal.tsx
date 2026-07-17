"use client"

import type { ReceiptPreview, SaleItemSummary, SerializedSale } from "./types"
import { formatSaleDate, formatUsd, getSaleBuyerName, getSaleOrigin, toNumber } from "./salesUtils"

type ReceiptModalProps = {
  preview: ReceiptPreview | null
  onClose: () => void
}

const printableLogo = `
  <svg
    width="60"
    height="30"
    viewBox="0 0 60 30"
    fill="#10233f"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M52.9051 0.169864C53.5247 0.174083 54.0903 0.524401 54.3719 1.07831L59.8256 11.8074C60.1293 12.4048 60.0462 13.1268 59.6149 13.6391L56.467 17.3776C55.0132 19.1042 52.8737 20.0982 50.6214 20.0935L39.8412 20.0709C38.8558 20.0688 37.9204 20.5064 37.2883 21.2651L34.1525 25.0293C34.1159 25.0732 34.0685 25.107 34.0151 25.1272L21.8445 29.7364C21.5245 29.8576 21.2532 29.4726 21.4736 29.2102L34.3083 13.9316C34.9377 13.1824 35.864 12.7494 36.8404 12.7479L51.1152 12.7261C52.0995 12.7246 53.0324 12.2846 53.6618 11.525L56.2871 8.35633C56.556 8.03167 56.3273 7.53927 55.9066 7.53733L40.4565 7.46611C40.1747 7.46482 40.0227 7.1339 40.2047 6.91797L45.4301 0.717513C45.7479 0.340395 46.2161 0.124323 46.7082 0.127674L52.9051 0.169864Z" />
    <path
      fill-rule="evenodd"
      clip-rule="evenodd"
      d="M33.3287 6.86922C33.0124 7.24555 32.5464 7.46212 32.0559 7.46077L13.5574 7.40976C12.6004 7.40712 11.6889 7.81922 11.0568 8.5403L3.69258 16.9407C3.41008 17.263 3.63725 17.7691 4.06492 17.7703L14.5701 17.7991C14.8644 17.7999 15.144 17.67 15.3338 17.4442L16.3762 16.2039C16.5582 15.9873 16.4048 15.6561 16.1225 15.6561L13.5029 15.6561C13.3899 15.6561 13.3286 15.5235 13.4015 15.4369L15.0543 13.4728C15.4331 13.0226 15.9906 12.7632 16.5777 12.7638L27.8692 12.7767C28.0667 12.777 28.1738 13.0088 28.0464 13.1602L18.5167 24.4932C18.2015 24.8682 17.7375 25.0845 17.2487 25.0845L7.68044 25.0846C7.0561 25.0846 6.48462 24.7328 6.20155 24.1743L0.189758 12.3128C-0.107083 11.7272 -0.0330145 11.021 0.378841 10.5102L4.82242 4.99902C7.35071 1.86327 11.1584 0.0460556 15.1776 0.0570848L38.2877 0.120503C38.5696 0.121277 38.7222 0.452076 38.5405 0.668309L33.3287 6.86922Z"
    />
  </svg>
`

function PrintableLogoMark({ className = "" }: { className?: string }) {
  return (
    <svg
      width="60"
      height="30"
      viewBox="0 0 60 30"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M52.9051 0.169864C53.5247 0.174083 54.0903 0.524401 54.3719 1.07831L59.8256 11.8074C60.1293 12.4048 60.0462 13.1268 59.6149 13.6391L56.467 17.3776C55.0132 19.1042 52.8737 20.0982 50.6214 20.0935L39.8412 20.0709C38.8558 20.0688 37.9204 20.5064 37.2883 21.2651L34.1525 25.0293C34.1159 25.0732 34.0685 25.107 34.0151 25.1272L21.8445 29.7364C21.5245 29.8576 21.2532 29.4726 21.4736 29.2102L34.3083 13.9316C34.9377 13.1824 35.864 12.7494 36.8404 12.7479L51.1152 12.7261C52.0995 12.7246 53.0324 12.2846 53.6618 11.525L56.2871 8.35633C56.556 8.03167 56.3273 7.53927 55.9066 7.53733L40.4565 7.46611C40.1747 7.46482 40.0227 7.1339 40.2047 6.91797L45.4301 0.717513C45.7479 0.340395 46.2161 0.124323 46.7082 0.127674L52.9051 0.169864Z" />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M33.3287 6.86922C33.0124 7.24555 32.5464 7.46212 32.0559 7.46077L13.5574 7.40976C12.6004 7.40712 11.6889 7.81922 11.0568 8.5403L3.69258 16.9407C3.41008 17.263 3.63725 17.7691 4.06492 17.7703L14.5701 17.7991C14.8644 17.7999 15.144 17.67 15.3338 17.4442L16.3762 16.2039C16.5582 15.9873 16.4048 15.6561 16.1225 15.6561L13.5029 15.6561C13.3899 15.6561 13.3286 15.5235 13.4015 15.4369L15.0543 13.4728C15.4331 13.0226 15.9906 12.7632 16.5777 12.7638L27.8692 12.7767C28.0667 12.777 28.1738 13.0088 28.0464 13.1602L18.5167 24.4932C18.2015 24.8682 17.7375 25.0845 17.2487 25.0845L7.68044 25.0846C7.0561 25.0846 6.48462 24.7328 6.20155 24.1743L0.189758 12.3128C-0.107083 11.7272 -0.0330145 11.021 0.378841 10.5102L4.82242 4.99902C7.35071 1.86327 11.1584 0.0460556 15.1776 0.0570848L38.2877 0.120503C38.5696 0.121277 38.7222 0.452076 38.5405 0.668309L33.3287 6.86922Z"
      />
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

function toSafeNumber(value: string | number | null | undefined) {
  return toNumber(value)
}

function getItemQuantity(item: SaleItemSummary) {
  return String(item.units)
}

function getItemUnitPrice(item: SaleItemSummary) {
  const unitPrice = toSafeNumber(item.unitPrice)
  if (unitPrice > 0) return unitPrice

  const units = item.units > 0 ? item.units : 1
  return toSafeNumber(item.lineTotal) / units
}

function getSaleDateOnly(date: string | null) {
  return formatSaleDate(date, "dd/MM/yyyy")
}

function getSaleTime(date: string | null) {
  return formatSaleDate(date, "HH:mm")
}

function getPrintableLogo() {
  return printableLogo
}

function printReceipt(sale: SerializedSale, receipt: ReceiptPreview["receipt"]) {
  const currentSale = sale
  const buyer = getSaleBuyerName(currentSale)
  const invoiceNumber = receipt.formattedNumber
  const saleDate = getSaleDateOnly(currentSale.date)
  const saleTime = getSaleTime(currentSale.date)

  const itemRows = currentSale.items
    .map((item) => {
      const quantity = getItemQuantity(item)
      const unitPrice = getItemUnitPrice(item)
      const lineTotal = toSafeNumber(item.lineTotal)

      return `
        <tr>
          <td class="description">
            ${escapeHtml(item.product.modelName)}
          </td>
          <td class="number quantity">
            ${escapeHtml(quantity)}
          </td>
          <td class="number">
            ${escapeHtml(formatUsd(unitPrice))}
          </td>
          <td class="number amount">
            ${escapeHtml(formatUsd(lineTotal))}
          </td>
        </tr>
      `
    })
    .join("")

  const html = `
    <!doctype html>
    <html lang="es">
      <head>
        <meta charset="utf-8" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1"
        />

        <title>Factura ${escapeHtml(invoiceNumber)}</title>

        <style>
          @page {
            size: A4 portrait;
            margin: 0;
          }

          * {
            box-sizing: border-box;
          }

          html,
          body {
            width: 210mm;
            min-height: 297mm;
            margin: 0;
            padding: 0;
            background: #ffffff;
            color: #111827;
            font-family:
              Arial,
              Helvetica,
              sans-serif;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }

          body {
            padding: 18mm 16mm 14mm;
          }

          .invoice {
            min-height: 265mm;
            display: flex;
            flex-direction: column;
          }

          .brand {
            display: flex;
            min-height: 42mm;
            align-items: flex-start;
          }

          .brand-logo {
            display: flex;
            align-items: center;
            color: #10233f;
          }

          .brand-name {
            margin-top: 3mm;
            color: #10233f;
            font-size: 11px;
            font-weight: 700;
            letter-spacing: 0.18em;
            text-transform: uppercase;
          }

          .metadata {
            display: grid;
            grid-template-columns: minmax(0, 1fr) 74mm;
            gap: 20mm;
            align-items: start;
            margin-top: 3mm;
            margin-bottom: 14mm;
          }

          .bill-to-label,
          .meta-label {
            color: #8b9199;
            font-size: 10px;
            font-weight: 400;
            line-height: 1.45;
            text-transform: uppercase;
          }

          .customer-name {
            margin-top: 1.5mm;
            color: #111827;
            font-size: 12px;
            font-weight: 600;
            line-height: 1.4;
            text-transform: uppercase;
          }

          .sale-origin {
            margin-top: 1.5mm;
            color: #6b7280;
            font-size: 9px;
            line-height: 1.4;
          }

          .meta-grid {
            display: grid;
            grid-template-columns: 34mm minmax(0, 1fr);
            column-gap: 6mm;
            row-gap: 1.2mm;
            font-size: 10px;
            line-height: 1.45;
          }

          .meta-value {
            color: #111827;
            font-weight: 500;
            overflow-wrap: anywhere;
          }

          table {
            width: 100%;
            border-collapse: collapse;
            table-layout: fixed;
          }

          col.description-column {
            width: auto;
          }

          col.quantity-column {
            width: 17mm;
          }

          col.rate-column {
            width: 28mm;
          }

          col.amount-column {
            width: 33mm;
          }

          thead {
            display: table-header-group;
          }

          thead th {
            padding: 3mm 2mm;
            border-right: 1px solid #d8dde3;
            background: #d4d8dd;
            color: #18304f;
            font-size: 9px;
            font-weight: 500;
            line-height: 1.2;
            text-align: right;
            text-transform: uppercase;
          }

          thead th:first-child {
            padding-left: 3mm;
            text-align: center;
          }

          thead th:last-child {
            border-right: 0;
          }

          tbody td {
            padding: 2.5mm 2mm 0;
            color: #111827;
            font-size: 10px;
            line-height: 1.35;
            vertical-align: top;
          }

          tbody td:first-child {
            padding-left: 2mm;
          }

          tbody tr:first-child td {
            padding-top: 4mm;
          }

          .description {
            overflow-wrap: anywhere;
          }

          .number {
            text-align: right;
            white-space: nowrap;
          }

          .quantity {
            text-align: center;
          }

          .totals {
            display: grid;
            grid-template-columns: minmax(0, 1fr) 50mm;
            gap: 10mm;
            align-items: center;
            margin-top: 5mm;
            padding-top: 5mm;
            border-top: 1px dashed #aeb5bd;
          }

          .total-label {
            color: #8b9199;
            font-size: 11px;
            text-align: right;
            text-transform: uppercase;
          }

          .total-value {
            color: #111827;
            font-size: 16px;
            font-weight: 700;
            text-align: right;
            white-space: nowrap;
          }

          .footer {
            margin-top: auto;
            padding-top: 16mm;
            color: #9298a0;
            font-size: 8px;
            line-height: 1.5;
            text-align: center;
          }

          .footer strong {
            color: #6b7280;
          }

          @media screen {
            html,
            body {
              width: 100%;
              min-height: 100%;
            }

            body {
              max-width: 210mm;
              min-height: 297mm;
              margin: 0 auto;
              box-shadow: 0 0 25px rgba(15, 23, 42, 0.12);
            }
          }

          @media print {
            html,
            body {
              width: 210mm;
              height: 297mm;
            }

            body {
              box-shadow: none;
            }

            .invoice {
              min-height: 265mm;
            }

            tr,
            td,
            th {
              break-inside: avoid;
            }
          }
        </style>
      </head>

      <body>
        <main class="invoice">
          <header class="brand">
            <div>
              <div class="brand-logo">
                ${getPrintableLogo()}
              </div>
              <div class="brand-name">GP Importaciones</div>
            </div>
          </header>

          <section class="metadata">
            <div>
              <div class="bill-to-label">Facturar a</div>
              <div class="customer-name">${escapeHtml(buyer)}</div>
            </div>

            <div class="meta-grid">
              <div class="meta-label">N.&ordm; de factura</div>
              <div class="meta-value">${escapeHtml(invoiceNumber)}</div>

              <div class="meta-label">Fecha</div>
              <div class="meta-value">${escapeHtml(saleDate)}</div>

              <div class="meta-label">Hora</div>
              <div class="meta-value">${escapeHtml(saleTime)}</div>

              <div class="meta-label">Condiciones</div>
              <div class="meta-value">Pago al recibir</div>

              <div class="meta-label">Vencimiento</div>
              <div class="meta-value">${escapeHtml(saleDate)}</div>
            </div>
          </section>

          <section>
            <table aria-label="Detalle de productos vendidos">
              <colgroup>
                <col class="description-column" />
                <col class="quantity-column" />
                <col class="rate-column" />
                <col class="amount-column" />
              </colgroup>

              <thead>
                <tr>
                  <th>Descripcion</th>
                  <th>Cant.</th>
                  <th>Tasa</th>
                  <th>Importe</th>
                </tr>
              </thead>

              <tbody>
                ${itemRows}
              </tbody>
            </table>

            <div class="totals">
              <div class="total-label">Total</div>
              <div class="total-value">
                ${escapeHtml(formatUsd(currentSale.total))}
              </div>
            </div>
          </section>

          <footer class="footer">
            <strong>GP Importaciones</strong><br />
            Comprobante interno correspondiente a la operacion registrada
            en el sistema.
          </footer>
        </main>

        <script>
          window.addEventListener("load", function () {
            window.focus();

            window.setTimeout(function () {
              window.print();
            }, 250);
          });
        </script>
      </body>
    </html>
  `

  const popup = window.open(
    "",
    "_blank",
    "width=960,height=800",
  )

  if (!popup) {
    window.alert(
      "El navegador bloqueo la ventana de impresion. Habilita las ventanas emergentes para generar el comprobante.",
    )
    return
  }

  popup.document.open()
  popup.document.write(html)
  popup.document.close()
}

export default function ReceiptModal({ preview, onClose }: ReceiptModalProps) {
  if (!preview) return null

  const { sale, receipt } = preview
  const buyer = getSaleBuyerName(sale)
  const saleDate = getSaleDateOnly(sale.date)
  const saleTime = getSaleTime(sale.date)

  return (
    <dialog className="modal modal-open">
      <div className="modal-box max-w-4xl rounded-lg">
        <div className="flex flex-col gap-6 rounded-lg border border-base-300 bg-base-100 p-5 text-sm sm:p-6">
          <header className="flex min-h-20 items-start">
            <div>
              <div className="flex items-center text-[#10233f]">
                <PrintableLogoMark className="fill-current" />
              </div>
              <div className="mt-3 text-[11px] font-bold uppercase tracking-[0.18em] text-[#10233f]">
                GP Importaciones
              </div>
            </div>
          </header>

          <section className="grid gap-6 md:grid-cols-[minmax(0,1fr)_280px]">
            <div>
              <div className="text-xs uppercase text-base-content/50">Facturar a</div>
              <div className="mt-1 font-semibold uppercase text-base-content">{buyer}</div>
            </div>

            <div className="grid grid-cols-[120px_minmax(0,1fr)] gap-x-4 gap-y-1 text-xs">
              <div className="uppercase text-base-content/50">N. de factura</div>
              <div className="font-medium">{receipt.formattedNumber}</div>

              <div className="uppercase text-base-content/50">Fecha</div>
              <div className="font-medium">{saleDate}</div>

              <div className="uppercase text-base-content/50">Hora</div>
              <div className="font-medium">{saleTime}</div>

              <div className="uppercase text-base-content/50">Condiciones</div>
              <div className="font-medium">Pago al recibir</div>

              <div className="uppercase text-base-content/50">Vencimiento</div>
              <div className="font-medium">{saleDate}</div>
            </div>
          </section>

          <section className="overflow-x-auto">
            <table className="table table-sm w-full">
              <thead className="bg-[#d4d8dd] text-[#18304f]">
                <tr>
                  <th className="text-center uppercase">Descripcion</th>
                  <th className="text-center uppercase">Cant.</th>
                  <th className="text-right uppercase">Tasa</th>
                  <th className="text-right uppercase">Importe</th>
                </tr>
              </thead>
              <tbody>
                {sale.items.map((item) => (
                  <tr key={item.id}>
                    <td>{item.product.modelName}</td>
                    <td className="text-center">{getItemQuantity(item)}</td>
                    <td className="text-right">{formatUsd(getItemUnitPrice(item))}</td>
                    <td className="text-right font-medium">{formatUsd(item.lineTotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="mt-5 grid grid-cols-[minmax(0,1fr)_160px] items-center gap-4 border-t border-dashed border-base-300 pt-4">
              <div className="text-right text-xs uppercase text-base-content/50">Total</div>
              <div className="text-right text-lg font-bold">{formatUsd(sale.total)}</div>
            </div>
          </section>

          <footer className="pt-8 text-center text-xs text-base-content/50">
            <strong>GP Importaciones</strong>
            <br />
            Comprobante interno correspondiente a la operacion registrada en el sistema.
          </footer>
        </div>

        <div className="modal-action">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cerrar
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => printReceipt(sale, receipt)}
          >
            Imprimir
          </button>
        </div>
      </div>
    </dialog>
  )
}
