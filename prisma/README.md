# Esquema de Base de Datos (Prisma)

Este esquema surge de los CSV exportados del Excel del cliente y está **normalizado** para:
- reducir redundancias del Excel,
- simplificar el MVP,
- y habilitar crecimiento hacia **SaaS multi-tenant**.

## Modelos

### Tenant
- **¿Para qué?** Aislar datos por “cliente mayorista” cuando el sistema evolucione a SaaS.
- **Campos:** `id, name, createdAt, updatedAt`.
- **Relaciones:** 1-N con `Product`, `Sale`, `WholesaleOrder`, `CostProfile`.
- **En R1:** basta un Tenant por defecto.

### Product
- **¿Para qué?** Catálogo único tanto de iPhones como de accesorios (evita dos tablas casi iguales).
- **Campos clave:**
  - `type`: `PHONE` o `ACCESSORY`.
  - `brand?`, `modelName`, `capacityGB?`, `condition?`, `color?`, `batteryPct?`.
  - `purchaseDate?`, `costPrice`, `salePrice`, `shippingCost?`, `status`, `stock`.
- **Relaciones:** N-1 con `Tenant`, 1-N con `SaleItem`.
- **Notas:**
  - Stock **agregado** (no por IMEI) como pidió el cliente.
  - Si más adelante se requiere IMEI, se agrega tabla `ProductSerial` sin romper el diseño.

### Sale (Venta)
- **¿Para qué?** Encabezado de venta.
- **Campos:** `date, customerName?, origin?, payment?, subtotal, extraCosts, total, profit`.
- **Relaciones:** N-1 con `Tenant`, 1-N con `SaleItem`.
- **Notas:** `origin` y `payment` son flexibles para mapear los CSV actuales.

### SaleItem (Renglón de venta)
- **¿Para qué?** Detalle de cada producto vendido.
- **Campos:** `units, unitPrice, unitCost, extraCost, lineTotal, lineCost, lineProfit`.
- **Relaciones:** N-1 con `Sale`, N-1 con `Product`, (opcional) N-1 con `CostProfile` (para saber qué “costo x equipo” se aplicó).
- **Lógica:** `lineTotal = units * unitPrice`; `lineCost = units * (unitCost + extraCost)`; `lineProfit = lineTotal - lineCost`.

### WholesaleOrder (Pedidos Mayoristas)
- **¿Para qué?** Reemplaza la hoja “Pedidos Mayoristas” con un modelo limpio para planificar y luego convertir en `Sale`.
- **Campos:** `customerName, modelName, color?, capacityGB?, condition?, units, status, unitCostRef?, unitPriceRef?`.
- **Relaciones:** N-1 con `Tenant`.
- **Notas:** No duplica `Product` si aún no existe; sirve para “intención de compra”.

### CostProfile (Costo x Equipo)
- **¿Para qué?** Modelar las columnas de `costo_x_equipo.csv` como **plantillas** aplicables a ventas/renglones.
- **Campos:** `name` + montos (funda, templado, cable, tarjetaGarantia, sticker, envio, cajita, bolsita, comision, total).
- **Relaciones:** N-1 con `Tenant`, opcional N-1 con `SaleItem` (si guardás qué perfil se aplicó).
- **Notas:** No es obligatorio usarlo en R1, pero deja el camino para margen real.

### Supplier (Proveedor)
- **¿Para qué?** Representa a los proveedores de los que se adquieren celulares y accesorios.
- **Campos:** `name, contactName?, phone?, email?, createdAt, updatedAt`.
- **Relaciones:** N-1 con `Tenant`, 1-N con `Purchase`.
- **Notas:** Permite centralizar la información de proveedores y reutilizarla en múltiples compras.

### Purchase (Compra)
- **¿Para qué?** Encabezado de una compra a un proveedor.  Agrupa varios ítems y permite registrar costos totales.
- **Campos:** `date, downPayment?, currency, totalCost, notes?`.
- **Relaciones:** N-1 con `Tenant`, N-1 con `Supplier`, 1-N con `PurchaseItem`.
- **Notas:** `downPayment` (seña) es opcional; `currency` permite usar ARS, USD o USDT.

### PurchaseItem
- **¿Para qué?** Detalle de cada producto adquirido en una compra.
- **Campos:** `units, unitCost, totalCost`.
- **Relaciones:** N-1 con `Purchase`, N-1 con `Product`.
- **Notas:** `totalCost = units * unitCost`; actualiza el stock de `Product` en operaciones de negocio.

## Relaciones (resumen)
- `Tenant` 1-N `Product`, `Sale`, `WholesaleOrder`, `CostProfile`, `Purchase`, `Supplier`.
- `Sale` 1-N `SaleItem`.
- `SaleItem` N-1 `Product` (y opcional N-1 `CostProfile`).
- `Purchase` 1-N `PurchaseItem`.
- `PurchaseItem` N-1 `Product`.

## Decisiones de diseño
- **Unificar productos** (teléfonos/accesorios) con `Product.type` para reutilizar UI y lógica de stock/venta.
- **Stock agregado** para cumplir el MVP y simplificar carga (sin IMEI).
- **`CostProfile`** como tabla separada para costos extra (accesorios/regalos/comisiones) sin ensuciar `Product`.
- **Multi-tenant desde el esquema**, pero con un solo `Tenant` en R1.
- **Enums** para `Condition`, `ProductStatus`, `PaymentMethod`, evitando strings sueltos.

## Migración desde CSV
- `stock_iphones.csv` → `Product` (type=PHONE) y setear `stock` según tu criterio inicial.
- `stock_accesorios.csv` → `Product` (type=ACCESSORY) + `stock`.
- `ventas.csv` → `Sale` y `SaleItem` (cuando limpies el CSV).
- `pedidos_mayoristas.csv` → `WholesaleOrder`.
- `costo_x_equipo.csv` → `CostProfile`.

## Caminos de evolución
- **R2:** `Purchase` + `Supplier` (entrada de stock con costos adicionales).
- **R3:** `Reportes` mensuales y exportaciones.
- **R4:** `Roles` (Admin/Vendedor) y dashboard avanzado.
- **R5:** Multi-tenant activo para 5 clientes mayoristas.

