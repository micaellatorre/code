/* eslint-disable @typescript-eslint/no-explicit-any */
import { PrismaClient, ProductType, ProductStatus, Condition, OrderStatus } from '@prisma/client'
import path from 'path'
import fs from 'fs'
// Eliminamos la dependencia de `csv-parse/sync` para evitar errores de
// importación. En su lugar implementamos un parser de CSV simple que
// soporta delimitadores comunes (coma, punto y coma, tabulador). Aunque no
// maneja comillas anidadas ni recuento de columnas variable tan
// rigurosamente como la librería externa, es suficiente para los archivos
// de ejemplo utilizados en este proyecto.

/*
 * Parsea un texto CSV en un array de objetos. La primera línea se
 * interpreta como encabezado y se normaliza con `normalizeHeader`. Cada
 * columna se separa por coma, punto y coma o tab. Las celdas se recortan y
 * se asignan al objeto resultante. Si una columna no está presente en una
 * fila, se asigna una cadena vacía.
 */
function parseCsv(raw: string): any[] {
  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
  if (lines.length === 0) return []
  const headerLine = lines.shift()!
  const headers = headerLine.split(/[;,\t]/).map((h) => normalizeHeader(h))
  const rows: any[] = []
  for (const line of lines) {
    const cols = line.split(/[;,\t]/)
    const obj: any = {}
    for (let i = 0; i < headers.length; i++) {
      const key = headers[i]
      if (!key) continue
      const val = cols[i] ?? ''
      obj[key] = typeof val === 'string' ? val.trim() : val
    }
    rows.push(obj)
  }
  return rows
}

const prisma = new PrismaClient()

// === Ajustá esta ruta si movés los CSV ===
// Asumiendo: code/prisma/seed.ts → CSVs en ../../excel_to_csv
const CSV_DIR = path.join(__dirname, '..', '..', 'excel_to_csv')

// Nombres de archivos esperados (ajustables)
const FILES = {
  iphones: 'stock_iphones.csv',
  accesorios: 'stock_accesorios.csv',
  pedidos: 'pedidos_mayoristas.csv',
  costos: 'costo_x_equipo.csv',
  ventas: 'ventas.csv',
}

// ---- Helpers de parsing / normalización ----
function normalizeHeader(h: string): string {
  return h
    .toLowerCase()
    .normalize('NFD')
    .replace(/[áàä]/g, 'a')
    .replace(/[éèë]/g, 'e')
    .replace(/[íìï]/g, 'i')
    .replace(/[óòö]/g, 'o')
    .replace(/[úùü]/g, 'u')
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]+/g, '')
    .trim()
}

function readCsv(filePath: string): any[] {
  if (!fs.existsSync(filePath)) return []
  const raw = fs.readFileSync(filePath, 'utf8')
  if (!raw.trim()) return []
  // Utilizamos nuestro parser personalizado en lugar de csv-parse. Aun así
  // normalizamos los encabezados y recortamos las celdas.
  const rows = parseCsv(raw)
  const normalized: any[] = []
  for (const r of rows) {
    const out: any = {}
    for (const k of Object.keys(r)) {
      if (!k || !String(k).trim()) continue
      const nk = normalizeHeader(k)
      out[nk] = typeof r[k] === 'string' ? r[k].trim() : r[k]
    }
    normalized.push(out)
  }
  return normalized
}

function num(x: any, fallback = 0): number {
  if (x === null || x === undefined) return fallback
  if (typeof x === 'number') return x
  if (typeof x !== 'string') return fallback
  const s = x.replace(/"/g, '').replace(/\./g, '').replace(',', '.').replace(/\s/g, '')
  const v = Number(s)
  return Number.isFinite(v) ? v : fallback
}

function dec(x: any, fallback = '0'): string {
  const n = num(x, Number(fallback))
  return n.toFixed(2)
}

function int(x: any, fallback = 0): number {
  const n = Math.trunc(num(x, fallback))
  return Number.isFinite(n) ? n : fallback
}

function text(x: any): string | null {
  if (x === undefined || x === null) return null
  const s = String(x).trim()
  return s.length ? s : null
}

function parseDate(x: any): Date | null {
  if (!x) return null
  let s = String(x).trim()
  if (!s) return null

  // Normaliza dobles separadores tipo "20//09/2025" -> "20/09/2025"
  s = s.replace(/[/\-\.]+/g, (m) => m[0])

  // yyyy-mm-dd
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s)
  if (iso) return new Date(`${iso[1]}-${iso[2]}-${iso[3]}T00:00:00Z`)

  // dd/mm/yyyy
  const latam = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s)
  if (latam) {
    const dd = latam[1].padStart(2, '0')
    const mm = latam[2].padStart(2, '0')
    const yyyy = latam[3]
    return new Date(`${yyyy}-${mm}-${dd}T00:00:00Z`)
  }

  const t = new Date(s)
  return isNaN(t.getTime()) ? null : t
}

function normalizeCondition(x: any): Condition | null {
  const s = String(x ?? '').toLowerCase().replace(/\s/g, '')
  if (!s) return null
  if (['a+', 'a_plus', 'aplus', 'a-plus'].includes(s)) return 'A_PLUS'
  if (['oem'].includes(s)) return 'OEM'
  if (['asis', 'as_is'].includes(s)) return 'ASIS'
  if (['asis+', 'as_is+', 'asisplus', 'as_is_plus'].includes(s)) return 'ASIS_PLUS'
  if (['sellado', 'sealed', 'selled'].includes(s)) return 'SEALED'
  if (['usado', 'used'].includes(s)) return 'ASIS' // mapeo suave si te viene "Usado"
  return null
}

async function findSimilarProduct(
  tenantId: string,
  type: ProductType,
  modelName: string,
  capacityGB?: number | null,
  condition?: Condition | null,
  color?: string | null
) {
  return prisma.product.findFirst({
    where: {
      tenantId,
      type,
      modelName,
      capacityGB: capacityGB ?? null,
      condition: condition ?? null,
      color: color ?? null,
    },
  })
}

// ---- Importadores por archivo ----
async function importIphones(tenantId: string) {
  const file = path.join(CSV_DIR, FILES.iphones)
  const rows = readCsv(file)
  let created = 0, updated = 0, skipped = 0

  for (const r of rows) {
    const modelName = text(r.modelo) ?? text(r.model) ?? text(r.nombre) ?? text(r.iphone) ?? 'Producto sin nombre'
    const capacityGB = r.capacidad_memoria_gb ? int(r.capacidad_memoria_gb, null as any) : null
    const condition = normalizeCondition(r.tipo_bateria ?? r.condicion) // tu CSV usa “tipo_bateria” como condición
    const color = text(r.color)
    const purchaseDate = parseDate(r.fecha_de_compra ?? r.f_compra ?? r.fecha)
    const costPrice = dec(r.costo_x_unidad ?? r.costo ?? r.costo_unitario ?? 0)
    const salePrice = dec(r.precio_venta_x_unidad ?? r.precio ?? r.precio_venta ?? 0)
    const shippingCost = r.costo_envio !== undefined ? dec(r.costo_envio) : null
    const stock = int(r.en_stock ?? r.stock ?? r.stock_actual ?? 0)
    const batteryPct = r.porcentaje_bateria !== undefined ? int(r.porcentaje_bateria) : null

    if (!modelName) { skipped++; continue }

    const exists = await findSimilarProduct(tenantId, 'PHONE', modelName!, capacityGB, condition ?? undefined, color ?? undefined)

    if (exists) {
      await prisma.product.update({
        where: { id: exists.id },
        data: {
          purchaseDate, costPrice, salePrice, shippingCost, stock,
          batteryPct,
          status: 'ACTIVE',
        },
      })
      updated++
    } else {
      await prisma.product.create({
        data: {
          tenantId,
          type: 'PHONE',
          brand: 'Apple', // asunción; ajustá si tenés marca en CSV
          modelName: modelName!,
          capacityGB,
          condition,
          color,
          batteryPct,
          purchaseDate,
          costPrice,
          salePrice,
          shippingCost,
          status: 'ACTIVE' as ProductStatus,
          stock,
        },
      })
      created++
    }
  }

  console.log(`[iPhones] filas=${rows.length} creados=${created} actualizados=${updated} saltados=${skipped}`)
}

async function importAccesorios(tenantId: string) {
  const file = path.join(CSV_DIR, FILES.accesorios)
  const rows = readCsv(file)
  let created = 0, updated = 0, skipped = 0

  for (const r of rows) {
    const modelName = text(r.modelo) ?? text(r.nombre) ?? text(r.accesorio) ?? 'Accesorio sin nombre'
    const color = text(r.color)
    const purchaseDate = parseDate(r.fecha_de_compra ?? r.fecha)
    const salePrice = dec(r.precio_venta_x_unidad ?? r.precio ?? 0)
    const costPrice = r.costo_total ? dec(r.costo_total) : (r.costo ?? r.costo_unitario ? dec(r.costo ?? r.costo_unitario) : '0')
    const stock = int(r.stock_actual ?? r.cantidad ?? r.en_stock ?? 0)

    if (!modelName) { skipped++; continue }

    const exists = await findSimilarProduct(tenantId, 'ACCESSORY', modelName!, null, null, color ?? undefined)

    if (exists) {
      await prisma.product.update({
        where: { id: exists.id },
        data: { purchaseDate, costPrice, salePrice, stock, status: 'ACTIVE' },
      })
      updated++
    } else {
      await prisma.product.create({
        data: {
          tenantId,
          type: 'ACCESSORY',
          brand: null,
          modelName: modelName!,
          capacityGB: null,
          condition: null,
          color,
          purchaseDate,
          costPrice,
          salePrice,
          shippingCost: null,
          status: 'ACTIVE',
          stock,
        },
      })
      created++
    }
  }

  console.log(`[Accesorios] filas=${rows.length} creados=${created} actualizados=${updated} saltados=${skipped}`)
}

async function importCostProfiles(tenantId: string) {
  const file = path.join(CSV_DIR, FILES.costos)
  const rows = readCsv(file)
  let upserts = 0

  for (const r of rows) {
    const name = text(r.nombre) ?? text(r.name) ?? text(r.perfil) ?? 'Costo x Equipo'
    const data = {
      name: name!,
      funda: r.funda ? dec(r.funda) : null,
      templado: r.templado ? dec(r.templado) : null,
      cable: r.cable ? dec(r.cable) : null,
      tarjetaGarantia: r.tarjeta_garantia ? dec(r.tarjeta_garantia) : null,
      sticker: r.sticker ? dec(r.sticker) : null,
      envio: r.envio ? dec(r.envio) : null,
      cajita: r.cajita ? dec(r.cajita) : null,
      bolsita: r.bolsita ? dec(r.bolsita) : null,
      comision: r.comision ? dec(r.comision) : null,
      total: r.total ? dec(r.total) : null,
    }

    const existing = await prisma.costProfile.findFirst({ where: { tenantId, name: data.name } })
    if (existing) {
      await prisma.costProfile.update({ where: { id: existing.id }, data })
    } else {
      await prisma.costProfile.create({ data: { tenantId, ...data } })
    }
    upserts++
  }
  console.log(`[CostProfiles] upserts=${upserts} (filas=${rows.length})`)
}

async function importWholesaleOrders(tenantId: string) {
  const file = path.join(CSV_DIR, FILES.pedidos)
  const rows = readCsv(file)
  let created = 0, skipped = 0

  for (const r of rows) {
    const customerName = text(r.cliente) ?? text(r.nombre) ?? 'Cliente'
    const modelName = text(r.modelo) ?? text(r.producto) ?? 'Modelo'
    const color = text(r.color)
    const capacityGB = r.capacidad_memoria_gb ? int(r.capacidad_memoria_gb, null as any) : null
    const condition = normalizeCondition(r.tipo_bateria ?? r.condicion)
    const units = int(r.cantidad ?? r.unidades ?? 1, 1)
    const requestedAt = parseDate(r.fecha_de ?? r.fecha ?? r.fecha_pedido) ?? new Date()
    const unitCostRef = r.costo_x_unidad ? dec(r.costo_x_unidad) : null
    const unitPriceRef = r.precio_venta_x_unidad ? dec(r.precio_venta_x_unidad) : null
    const notes = text(r.notas) ?? null

    if (!modelName) { skipped++; continue }

    await prisma.wholesaleOrder.create({
      data: {
        tenantId,
        customerName: customerName ?? 'Cliente',
        modelName,
        color,
        capacityGB,
        condition,
        units,
        requestedAt,
        status: 'OPEN' as OrderStatus,
        unitCostRef,
        unitPriceRef,
        notes,
      },
    })
    created++
  }

  console.log(`[Pedidos Mayoristas] filas=${rows.length} creados=${created} saltados=${skipped}`)
}

async function importSales(tenantId: string) {
  const file = path.join(CSV_DIR, FILES.ventas)
  if (!fs.existsSync(file)) {
    console.log('[Ventas] archivo no encontrado, omitiendo.')
    return
  }
  const rows = readCsv(file)
  if (!rows.length) {
    console.log('[Ventas] CSV vacío o con encabezados problemáticos, omitiendo.')
    return
  }

  let salesCreated = 0, itemsCreated = 0, skipped = 0

  for (const r of rows) {
    // normalizaciones útiles
    const modelName = text(r.modelo) ?? text(r.producto) ?? null
    const qty = int(r.cantidad ?? r.unidades ?? 1, 1)

    // 1) skip filas sin modelo
    if (!modelName) {
      skipped++
      continue
    }

    // 2) skip filas con cantidad 0
    if (qty <= 0) {
      console.warn(`[Ventas] fila con cantidad=0 para modelo "${modelName}", se omite.`)
      skipped++
      continue
    }

    // 3) skip filas "Mayorista" (parecen resumen/placeholder)
    if (modelName.toLowerCase() === 'mayorista') {
      console.warn('[Ventas] fila "Mayorista" detectada (posible resumen). Se omite.')
      skipped++
      continue
    }

    // 4) NA → null en campos clave
    const norm = (v: any) => {
      const s = String(v ?? '').trim().toLowerCase()
      return s === 'na' || s === '' ? null : v
    }
    const color = text(norm(r.color))
    const capacityGB = norm(r.capacidad_memoria_gb) ? int(r.capacidad_memoria_gb, null as any) : null

    const date = parseDate(r.fecha) ?? parseDate(r.fecha_venta) ?? new Date()
    const customerName = text(r.cliente) ?? text(r.comprador) ?? null
    const origin = text(r.origen) ?? null

    // Mapear "pago" a tu enum PaymentMethod + base futura
    const payment = ((): any => {
      const raw = String(r.metodo_pago ?? r.pago ?? '').trim().toLowerCase()

      // casos exactos del CSV actual:
      if (raw === 'trasnferencia pesos' || raw === 'transferencia pesos') return 'TRANSFERENCIA_ARS'
      if (raw === 'efectivo dolares' || raw === 'efectivo dólares') return 'EFECTIVO_USD'
      if (raw === 'na' || raw === '') return null

      // base futura (queda por si aparecen luego):
      if (raw.includes('efectivo') && raw.includes('usd')) return 'EFECTIVO_USD'
      if (raw.includes('efectivo')) return 'EFECTIVO_PESOS'
      if ((raw.includes('transfer') || raw.includes('trasn')) && raw.includes('usd')) return 'TRANSFERENCIA_USD'
      if (raw.includes('transfer') || raw.includes('trasn')) return 'TRANSFERENCIA_ARS'
      if (raw.includes('tarj')) return 'TARJETA'
      if (raw.includes('usdt')) return 'USDT'
      return null
    })()

    // tratar de localizar producto existente
    const product = await prisma.product.findFirst({
      where: {
        tenantId,
        modelName,
        color: color ?? undefined,
        capacityGB: capacityGB ?? undefined,
      },
      orderBy: { createdAt: 'desc' },
    })

    // números
    const units = qty
    const unitPrice = dec(r.precio_unitario ?? r.precio_venta ?? r.precio_venta_x_unidad ?? r.facturacion ?? r.precio ?? 0)
    const unitCost = product ? product.costPrice.toString() : dec(r.costo_unitario ?? r.costo_producto ?? r.costo ?? 0)
    const extraCost = r.costo_x_equipo ? dec(r.costo_x_equipo) : '0'

    const lineTotal = (num(unitPrice) * units).toFixed(2)
    const lineCost = (units * (num(unitCost) + num(extraCost))).toFixed(2)
    const lineProfit = (num(lineTotal) - num(lineCost)).toFixed(2)

    // Crear venta + item
    const sale = await prisma.sale.create({
      data: {
        tenantId,
        date,
        customerName,
        origin,
        payment,
        subtotal: lineTotal,
        extraCosts: (num(extraCost) * units).toFixed(2),
        total: lineTotal,
        profit: lineProfit,
      },
    })
    salesCreated++

    const productId = product
      ? product.id
      : (
          await prisma.product.create({
            data: {
              tenantId,
              type: 'PHONE', // si modelo luce accesorio, igual lo damos de alta; podés mejorar heurística
              brand: null,
              modelName: modelName!,
              capacityGB,
              condition: normalizeCondition(r.bateria) ?? null, // en ventas vino "Usado" a veces
              color,
              costPrice: unitCost,
              salePrice: unitPrice,
              status: 'ACTIVE',
              stock: 0,
            },
          })
        ).id

    await prisma.saleItem.create({
      data: {
        saleId: sale.id,
        productId,
        units,
        unitPrice,
        unitCost,
        extraCost,
        lineTotal,
        lineCost,
        lineProfit,
      },
    })
    itemsCreated++

    // Descontar stock si el producto existía
    if (product) {
      await prisma.product.update({
        where: { id: product.id },
        data: { stock: Math.max(0, (product.stock ?? 0) - units) },
      })
    }
  }

  console.log(`[Ventas] ventas=${salesCreated} items=${itemsCreated} saltadas=${skipped}`)
}

// ---- MAIN ----
async function main() {
  console.log('=== Seed: importación desde CSV ===')
  console.log('CSV dir:', CSV_DIR)

  // Tenant por defecto
  let tenant = await prisma.tenant.findFirst({ where: { name: 'Default' } })
  if (!tenant) {
    tenant = await prisma.tenant.create({ data: { name: 'Default' } })
  }
  const tenantId = tenant.id

  await importIphones(tenantId)
  await importAccesorios(tenantId)
  await importCostProfiles(tenantId)
  await importWholesaleOrders(tenantId)
  await importSales(tenantId)

  console.log('=== Seed: DONE ===')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
