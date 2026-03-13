"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
/* eslint-disable @typescript-eslint/no-explicit-any */
const client_1 = require("@prisma/client");
const adapter_pg_1 = require("@prisma/adapter-pg");
const pg_1 = require("pg");
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const sync_1 = require("csv-parse/sync");
const _pool = new pg_1.Pool({ connectionString: process.env.DATABASE_URL });
const _adapter = new adapter_pg_1.PrismaPg(_pool);
const prisma = new client_1.PrismaClient({ adapter: _adapter });
// === Ajustá esta ruta si movés los CSV ===
// Asumiendo: code/prisma/seed.ts → CSVs en ../../excel_to_csv
const CSV_DIR = path_1.default.join(__dirname, '..', '..', 'excel_to_csv');
// Nombres de archivos esperados (ajustables)
const FILES = {
    iphones: 'stock_iphones.csv',
    accesorios: 'stock_accesorios.csv',
    pedidos: 'pedidos_mayoristas.csv',
    costos: 'costo_x_equipo.csv',
    ventas: 'ventas.csv',
};
// ---- Helpers de parsing / normalización ----
function normalizeHeader(h) {
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
        .trim();
}
function readCsv(filePath) {
    if (!fs_1.default.existsSync(filePath))
        return [];
    const raw = fs_1.default.readFileSync(filePath, 'utf8');
    if (!raw.trim())
        return [];
    // Parser tolerante a:
    // - filas con más/menos columnas
    // - comillas raras, BOM, espacios
    // - delimitadores ; , o tab
    const rows = (0, sync_1.parse)(raw, {
        columns: true,
        bom: true,
        trim: true,
        skip_empty_lines: true,
        relax_column_count: true,
        relax_column_count_less: true,
        relax_column_count_more: true,
        relax_quotes: true,
        delimiter: [',', ';', '\t'],
    });
    // Normalizar headers => snake_case sin acentos y sin claves vacías
    return rows.map((r) => {
        const out = {};
        for (const k of Object.keys(r)) {
            if (!k || !String(k).trim())
                continue; // ignora clave vacía (columna “fantasma”)
            const nk = normalizeHeader(k);
            out[nk] = typeof r[k] === 'string' ? r[k].trim() : r[k];
        }
        return out;
    });
}
function num(x, fallback = 0) {
    if (x === null || x === undefined)
        return fallback;
    if (typeof x === 'number')
        return x;
    if (typeof x !== 'string')
        return fallback;
    const s = x.replace(/"/g, '').replace(/\./g, '').replace(',', '.').replace(/\s/g, '');
    const v = Number(s);
    return Number.isFinite(v) ? v : fallback;
}
function dec(x, fallback = '0') {
    const n = num(x, Number(fallback));
    return n.toFixed(2);
}
function int(x, fallback = 0) {
    const n = Math.trunc(num(x, fallback));
    return Number.isFinite(n) ? n : fallback;
}
function text(x) {
    if (x === undefined || x === null)
        return null;
    const s = String(x).trim();
    return s.length ? s : null;
}
function parseDate(x) {
    if (!x)
        return null;
    let s = String(x).trim();
    if (!s)
        return null;
    // Normaliza dobles separadores tipo "20//09/2025" -> "20/09/2025"
    s = s.replace(/[/\-\.]+/g, (m) => m[0]);
    // yyyy-mm-dd
    const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
    if (iso)
        return new Date(`${iso[1]}-${iso[2]}-${iso[3]}T00:00:00Z`);
    // dd/mm/yyyy
    const latam = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s);
    if (latam) {
        const dd = latam[1].padStart(2, '0');
        const mm = latam[2].padStart(2, '0');
        const yyyy = latam[3];
        return new Date(`${yyyy}-${mm}-${dd}T00:00:00Z`);
    }
    const t = new Date(s);
    return isNaN(t.getTime()) ? null : t;
}
function normalizeCondition(x) {
    const s = String(x ?? '').toLowerCase().replace(/\s/g, '');
    if (!s)
        return null;
    if (['a+', 'a_plus', 'aplus', 'a-plus'].includes(s))
        return 'A_PLUS';
    if (['oem'].includes(s))
        return 'OEM';
    if (['asis', 'as_is'].includes(s))
        return 'ASIS';
    if (['asis+', 'as_is+', 'asisplus', 'as_is_plus'].includes(s))
        return 'ASIS_PLUS';
    if (['sellado', 'sealed', 'selled'].includes(s))
        return 'SEALED';
    if (['usado', 'used'].includes(s))
        return 'ASIS'; // mapeo suave si te viene "Usado"
    return null;
}
async function findSimilarProduct(tenantId, type, modelName, capacityGB, condition, color) {
    return prisma.product.findFirst({
        where: {
            tenantId,
            type,
            modelName,
            capacityGB: capacityGB ?? null,
            condition: condition ?? null,
            color: color ?? null,
        },
    });
}
// ---- Importadores por archivo ----
async function importIphones(tenantId) {
    const file = path_1.default.join(CSV_DIR, FILES.iphones);
    const rows = readCsv(file);
    let created = 0, updated = 0, skipped = 0;
    for (const r of rows) {
        const modelName = text(r.modelo) ?? text(r.model) ?? text(r.nombre) ?? text(r.iphone) ?? 'Producto sin nombre';
        const capacityGB = r.capacidad_memoria_gb ? int(r.capacidad_memoria_gb, null) : null;
        const condition = normalizeCondition(r.tipo_bateria ?? r.condicion); // tu CSV usa “tipo_bateria” como condición
        const color = text(r.color);
        const purchaseDate = parseDate(r.fecha_de_compra ?? r.f_compra ?? r.fecha);
        const costPrice = dec(r.costo_x_unidad ?? r.costo ?? r.costo_unitario ?? 0);
        const salePrice = dec(r.precio_venta_x_unidad ?? r.precio ?? r.precio_venta ?? 0);
        const shippingCost = r.costo_envio !== undefined ? dec(r.costo_envio) : null;
        const stock = int(r.en_stock ?? r.stock ?? r.stock_actual ?? 0);
        const batteryPct = r.porcentaje_bateria !== undefined ? int(r.porcentaje_bateria) : null;
        if (!modelName) {
            skipped++;
            continue;
        }
        const exists = await findSimilarProduct(tenantId, 'PHONE', modelName, capacityGB, condition ?? undefined, color ?? undefined);
        if (exists) {
            await prisma.product.update({
                where: { id: exists.id },
                data: {
                    purchaseDate, costPrice, salePrice, shippingCost, stock,
                    batteryPct,
                    status: 'AVAILABLE',
                },
            });
            updated++;
        }
        else {
            await prisma.product.create({
                data: {
                    tenantId,
                    type: 'PHONE',
                    brand: 'Apple', // asunción; ajustá si tenés marca en CSV
                    modelName: modelName,
                    capacityGB,
                    condition,
                    color,
                    batteryPct,
                    purchaseDate,
                    costPrice,
                    salePrice,
                    shippingCost,
                    status: 'AVAILABLE',
                    stock,
                },
            });
            created++;
        }
    }
    console.log(`[iPhones] filas=${rows.length} creados=${created} actualizados=${updated} saltados=${skipped}`);
}
async function importAccesorios(tenantId) {
    const file = path_1.default.join(CSV_DIR, FILES.accesorios);
    const rows = readCsv(file);
    let created = 0, updated = 0, skipped = 0;
    for (const r of rows) {
        const modelName = text(r.modelo) ?? text(r.nombre) ?? text(r.accesorio) ?? 'Accesorio sin nombre';
        const color = text(r.color);
        const purchaseDate = parseDate(r.fecha_de_compra ?? r.fecha);
        const salePrice = dec(r.precio_venta_x_unidad ?? r.precio ?? 0);
        const costPrice = r.costo_total ? dec(r.costo_total) : (r.costo ?? r.costo_unitario ? dec(r.costo ?? r.costo_unitario) : '0');
        const stock = int(r.stock_actual ?? r.cantidad ?? r.en_stock ?? 0);
        if (!modelName) {
            skipped++;
            continue;
        }
        const exists = await findSimilarProduct(tenantId, 'ACCESSORY', modelName, null, null, color ?? undefined);
        if (exists) {
            await prisma.product.update({
                where: { id: exists.id },
                data: { purchaseDate, costPrice, salePrice, stock, status: 'AVAILABLE' },
            });
            updated++;
        }
        else {
            await prisma.product.create({
                data: {
                    tenantId,
                    type: 'ACCESSORY',
                    brand: null,
                    modelName: modelName,
                    capacityGB: null,
                    condition: null,
                    color,
                    purchaseDate,
                    costPrice,
                    salePrice,
                    shippingCost: null,
                    status: 'AVAILABLE',
                    stock,
                },
            });
            created++;
        }
    }
    console.log(`[Accesorios] filas=${rows.length} creados=${created} actualizados=${updated} saltados=${skipped}`);
}
async function importCostProfiles(tenantId) {
    const file = path_1.default.join(CSV_DIR, FILES.costos);
    const rows = readCsv(file);
    let upserts = 0;
    for (const r of rows) {
        const name = text(r.nombre) ?? text(r.name) ?? text(r.perfil) ?? 'Costo x Equipo';
        const data = {
            name: name,
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
        };
        const existing = await prisma.costProfile.findFirst({ where: { tenantId, name: data.name } });
        if (existing) {
            await prisma.costProfile.update({ where: { id: existing.id }, data });
        }
        else {
            await prisma.costProfile.create({ data: { tenantId, ...data } });
        }
        upserts++;
    }
    console.log(`[CostProfiles] upserts=${upserts} (filas=${rows.length})`);
}
async function importWholesaleOrders(tenantId) {
    const file = path_1.default.join(CSV_DIR, FILES.pedidos);
    const rows = readCsv(file);
    let created = 0, skipped = 0;
    for (const r of rows) {
        const customerName = text(r.cliente) ?? text(r.nombre) ?? 'Cliente';
        const modelName = text(r.modelo) ?? text(r.producto) ?? 'Modelo';
        const color = text(r.color);
        const capacityGB = r.capacidad_memoria_gb ? int(r.capacidad_memoria_gb, null) : null;
        const condition = normalizeCondition(r.tipo_bateria ?? r.condicion);
        const units = int(r.cantidad ?? r.unidades ?? 1, 1);
        const requestedAt = parseDate(r.fecha_de ?? r.fecha ?? r.fecha_pedido) ?? new Date();
        const unitCostRef = r.costo_x_unidad ? dec(r.costo_x_unidad) : null;
        const unitPriceRef = r.precio_venta_x_unidad ? dec(r.precio_venta_x_unidad) : null;
        const notes = text(r.notas) ?? null;
        if (!modelName) {
            skipped++;
            continue;
        }
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
                status: 'OPEN',
                unitCostRef,
                unitPriceRef,
                notes,
            },
        });
        created++;
    }
    console.log(`[Pedidos Mayoristas] filas=${rows.length} creados=${created} saltados=${skipped}`);
}
async function importSales(tenantId) {
    const file = path_1.default.join(CSV_DIR, FILES.ventas);
    if (!fs_1.default.existsSync(file)) {
        console.log('[Ventas] archivo no encontrado, omitiendo.');
        return;
    }
    const rows = readCsv(file);
    if (!rows.length) {
        console.log('[Ventas] CSV vacío o con encabezados problemáticos, omitiendo.');
        return;
    }
    let salesCreated = 0, itemsCreated = 0, skipped = 0;
    for (const r of rows) {
        // normalizaciones útiles
        const modelName = text(r.modelo) ?? text(r.producto) ?? null;
        const qty = int(r.cantidad ?? r.unidades ?? 1, 1);
        // 1) skip filas sin modelo
        if (!modelName) {
            skipped++;
            continue;
        }
        // 2) skip filas con cantidad 0
        if (qty <= 0) {
            console.warn(`[Ventas] fila con cantidad=0 para modelo "${modelName}", se omite.`);
            skipped++;
            continue;
        }
        // 3) skip filas "Mayorista" (parecen resumen/placeholder)
        if (modelName.toLowerCase() === 'mayorista') {
            console.warn('[Ventas] fila "Mayorista" detectada (posible resumen). Se omite.');
            skipped++;
            continue;
        }
        // 4) NA → null en campos clave
        const norm = (v) => {
            const s = String(v ?? '').trim().toLowerCase();
            return s === 'na' || s === '' ? null : v;
        };
        const color = text(norm(r.color));
        const capacityGB = norm(r.capacidad_memoria_gb) ? int(r.capacidad_memoria_gb, null) : null;
        const date = parseDate(r.fecha) ?? parseDate(r.fecha_venta) ?? new Date();
        const customerName = text(r.cliente) ?? text(r.comprador) ?? null;
        const origin = text(r.origen) ?? null;
        // Mapear "pago" a tu enum PaymentMethod + base futura
        const payment = (() => {
            const raw = String(r.metodo_pago ?? r.pago ?? '').trim().toLowerCase();
            // casos exactos del CSV actual:
            if (raw === 'trasnferencia pesos' || raw === 'transferencia pesos')
                return 'TRANSFERENCIA_ARS';
            if (raw === 'efectivo dolares' || raw === 'efectivo dólares')
                return 'EFECTIVO_USD';
            if (raw === 'na' || raw === '')
                return null;
            // base futura (queda por si aparecen luego):
            if (raw.includes('efectivo') && raw.includes('usd'))
                return 'EFECTIVO_USD';
            if (raw.includes('efectivo'))
                return 'EFECTIVO_PESOS';
            if ((raw.includes('transfer') || raw.includes('trasn')) && raw.includes('usd'))
                return 'TRANSFERENCIA_USD';
            if (raw.includes('transfer') || raw.includes('trasn'))
                return 'TRANSFERENCIA_ARS';
            if (raw.includes('tarj'))
                return 'TARJETA';
            if (raw.includes('usdt'))
                return 'USDT';
            return null;
        })();
        // tratar de localizar producto existente
        const product = await prisma.product.findFirst({
            where: {
                tenantId,
                modelName,
                color: color ?? undefined,
                capacityGB: capacityGB ?? undefined,
            },
            orderBy: { createdAt: 'desc' },
        });
        // números
        const units = qty;
        const unitPrice = dec(r.precio_unitario ?? r.precio_venta ?? r.precio_venta_x_unidad ?? r.facturacion ?? r.precio ?? 0);
        const unitCost = product ? product.costPrice.toString() : dec(r.costo_unitario ?? r.costo_producto ?? r.costo ?? 0);
        const extraCost = r.costo_x_equipo ? dec(r.costo_x_equipo) : '0';
        const lineTotal = (num(unitPrice) * units).toFixed(2);
        const lineCost = (units * (num(unitCost) + num(extraCost))).toFixed(2);
        const lineProfit = (num(lineTotal) - num(lineCost)).toFixed(2);
        // Crear venta + item
        const sale = await prisma.sale.create({
            data: {
                tenantId,
                date,
                customerName,
                origin,
                subtotal: lineTotal,
                costTotal: lineCost,
                extraCosts: (num(extraCost) * units).toFixed(2),
                total: lineTotal,
                profit: lineProfit,
            },
        });
        salesCreated++;
        const productId = product
            ? product.id
            : (await prisma.product.create({
                data: {
                    tenantId,
                    type: 'PHONE', // si modelo luce accesorio, igual lo damos de alta; podés mejorar heurística
                    brand: null,
                    modelName: modelName,
                    capacityGB,
                    condition: normalizeCondition(r.bateria) ?? null, // en ventas vino "Usado" a veces
                    color,
                    costPrice: unitCost,
                    salePrice: unitPrice,
                    status: 'AVAILABLE',
                    stock: 0,
                },
            })).id;
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
        });
        itemsCreated++;
        // Descontar stock si el producto existía
        if (product) {
            await prisma.product.update({
                where: { id: product.id },
                data: { stock: Math.max(0, (product.stock ?? 0) - units) },
            });
        }
    }
    console.log(`[Ventas] ventas=${salesCreated} items=${itemsCreated} saltadas=${skipped}`);
}
// ---- MAIN ----
async function main() {
    console.log('=== Seed: importación desde CSV ===');
    console.log('CSV dir:', CSV_DIR);
    // Tenant por defecto
    let tenant = await prisma.tenant.findFirst({ where: { name: 'Default' } });
    if (!tenant) {
        tenant = await prisma.tenant.create({ data: { name: 'Default' } });
    }
    const tenantId = tenant.id;
    await importIphones(tenantId);
    await importAccesorios(tenantId);
    await importCostProfiles(tenantId);
    await importWholesaleOrders(tenantId);
    await importSales(tenantId);
    console.log('=== Seed: DONE ===');
}
main()
    .catch((e) => {
    console.error(e);
    process.exit(1);
})
    .finally(async () => {
    await prisma.$disconnect();
});
