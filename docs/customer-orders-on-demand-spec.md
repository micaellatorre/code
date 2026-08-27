# Customer Orders / Pedidos On-Demand

## 1. Objetivo

Incorporar un dominio de **Pedidos de Cliente** previo a la venta definitiva para GP Importaciones / TECH-STOCK.

El pedido representa un compromiso comercial con un Buyer cuando uno o más productos:

- todavía no existen físicamente en stock;
- todavía no fueron comprados al proveedor;
- pueden tener precio de venta acordado pero costo de adquisición aún desconocido;
- conviven en el mismo carrito con accesorios que sí están físicamente en stock;
- pueden recibir una seña o pago total antes de la entrega;
- deben convertirse posteriormente en una `Sale` sin duplicar los ingresos ya registrados en Caja.

`WholesaleOrder` permanece **legacy** y fuera del alcance de esta rama. No se migra ni se elimina porque no interfiere con el nuevo dominio y hoy tiene bajo uso.

---

## 2. Decisiones de dominio

### 2.1 Pedido no es Venta

`Sale` representa la operación comercial definitiva, con productos físicos identificados, costo histórico, margen y salida final de inventario.

`CustomerOrder` puede existir antes de que el producto físico exista. Por lo tanto:

- no se crea una `Sale` al tomar una seña;
- no se inventa un `Product` placeholder para representar un equipo todavía no adquirido;
- no se calcula margen definitivo si existe un ítem sin costo real;
- la venta se genera únicamente al entregar/consolidar el pedido.

### 2.2 Pedido no es Reservation

`Reservation` permanece orientada a reservar inventario físico existente.

`CustomerOrder` soporta carrito mixto:

- `STOCK`: producto existente que debe bloquear disponibilidad;
- `ON_DEMAND`: producto todavía inexistente físicamente.

### 2.3 Pagos

Los pagos de pedido reutilizan el motor `payment-pricing.ts`.

Cada pago persiste:

- importe nativo;
- moneda;
- tipo de cambio histórico;
- equivalente USD real (`amountUsd`);
- deuda comercial cubierta (`coveredBaseUsd`);
- recargos;
- cuotas;
- snapshot de pricing;
- cuenta de Caja real.

No existe una "Caja Anticipos". El dinero ingresa a la cuenta real seleccionada y el ledger identifica el origen como `CUSTOMER_ORDER_PAYMENT`.

### 2.4 Conversión a venta

Al convertir el pedido:

1. Todos los ítems deben tener un `fulfilledProductId` físico.
2. Todos los costos reales deben ser conocidos.
3. Las asignaciones de stock deben estar activas.
4. Se crea `Sale` + `SaleItem`.
5. Se copian los pagos a `Payment` con referencia `originCustomerOrderPaymentId`.
6. **No** se crean nuevos `CashMovement` por esos pagos.
7. Se consume el inventario físico reservado.
8. El pedido queda `CONVERTED` y relacionado con la venta.

---

## 3. ER propuesto (Prisma)

```text
Tenant
 ├── CustomerOrder[]
 └── TenantSettings
       ├── customerOrderMinimumDepositUsd
       ├── customerOrderDefaultDeliveryDays
       └── customerOrderDeliveryDisclaimer

Buyer
 └── CustomerOrder[]

User
 ├── customerOrdersCreated[]
 └── customerOrdersAssigned[]

Branch
 └── CustomerOrder[]

CustomerOrder
 ├── buyer -> Buyer
 ├── createdBy -> User?
 ├── assignedSeller -> User?
 ├── branch -> Branch
 ├── items -> CustomerOrderItem[]
 ├── payments -> CustomerOrderPayment[]
 ├── allocations -> CustomerOrderInventoryAllocation[]
 └── convertedSale -> Sale?

CustomerOrderItem
 ├── order -> CustomerOrder
 ├── stockProduct -> Product?           // producto existente seleccionado
 ├── fulfilledProduct -> Product?       // producto físico definitivo
 ├── purchaseItem -> PurchaseItem?      // trazabilidad opcional de compra
 ├── catalogModel -> ProductCatalogModel?
 ├── catalogCapacity -> ProductCatalogCapacity?
 └── catalogColor -> ProductCatalogColor?

CustomerOrderInventoryAllocation
 ├── order -> CustomerOrder
 ├── item -> CustomerOrderItem
 └── product -> Product

CustomerOrderPayment
 ├── order -> CustomerOrder
 ├── cashAccount -> CashAccount?
 └── convertedSalePayment -> Payment?

Payment
 └── originCustomerOrderPayment -> CustomerOrderPayment?
```

### 3.1 CustomerOrder

Campos principales:

- `id`
- `orderNumber` autoincremental y único
- `tenantId`
- `buyerId` obligatorio
- `createdById` opcional para permitir futuro origen e-commerce
- `assignedSellerId` opcional
- `branchId`
- `convertedSaleId` único/opcional
- `status`
- `source`
- `requestedAt`
- `estimatedDeliveryAt`
- `agreedTotalUsd`
- `amountPaidUsd`
- `balanceDueUsd`
- `notes`
- `cancelledAt`
- `convertedAt`
- timestamps

### 3.2 CustomerOrderItem

Campos principales:

- `kind`: `STOCK | ON_DEMAND`
- `stockProductId?`
- `fulfilledProductId?`
- referencias opcionales a catálogo
- snapshots descriptivos (`descriptionSnapshot`, modelo, capacidad, color, condición)
- `quantity`
- `unitPriceUsd`
- `unitCostUsd?`
- `lineTotalUsd`
- `notes`

Reglas:

- `STOCK` requiere `stockProductId`.
- `STOCK` inicia con `fulfilledProductId = stockProductId`.
- `ON_DEMAND` puede iniciar sin ningún `Product`.
- `unitCostUsd` puede ser null mientras no se conozca el costo real.

### 3.3 CustomerOrderInventoryAllocation

Representa bloqueo de disponibilidad, no salida física.

- creación: decrementa `Product.stockAvailable`;
- consumo: decrementa `Product.stock`, sin volver a decrementar `stockAvailable`;
- liberación: incrementa `stockAvailable`;
- la fila nunca se elimina: cambia de estado para trazabilidad.

### 3.4 CustomerOrderPayment

Replica la semántica financiera moderna de `Payment`:

- `method`
- `currency`
- `amount`
- `exchangeRate`
- `amountUsd`
- `coveredBaseUsd`
- `surchargePct`
- `surchargeAmount`
- `installments`
- `installmentAmount`
- `pricingSnapshot`
- `cashAccountId`
- `paidAt`
- `note`

---

## 4. Máquina de estados

```text
CONFIRMED
   │
   ├──> PROCUREMENT_PENDING
   │        │
   │        └──> ORDERED_TO_SUPPLIER
   │                 │
   │                 └──> IN_TRANSIT
   │                           │
   │                           └──> RECEIVED
   │                                  │
   └──────────────────────────────────┴──> READY_FOR_DELIVERY
                                                │
                                                └──> CONVERTED

Cualquier estado no terminal ──> CANCELLED
```

Transiciones permitidas:

| Desde | Hacia |
|---|---|
| CONFIRMED | PROCUREMENT_PENDING, READY_FOR_DELIVERY, CANCELLED |
| PROCUREMENT_PENDING | ORDERED_TO_SUPPLIER, CANCELLED |
| ORDERED_TO_SUPPLIER | IN_TRANSIT, RECEIVED, CANCELLED |
| IN_TRANSIT | RECEIVED, CANCELLED |
| RECEIVED | READY_FOR_DELIVERY, CANCELLED |
| READY_FOR_DELIVERY | CONVERTED, CANCELLED |
| CONVERTED | terminal |
| CANCELLED | terminal |

`CONVERTED` solo se alcanza mediante el servicio de conversión a `Sale`, no mediante un cambio manual de estado.

El estado de pago es derivado:

- `UNPAID`: `amountPaidUsd <= 0`
- `PARTIAL`: `0 < amountPaidUsd < agreedTotalUsd`
- `PAID`: `amountPaidUsd >= agreedTotalUsd`

---

## 5. Reglas de stock

### 5.1 Ítem STOCK

Al confirmar el pedido:

1. validar tenant;
2. validar estado vendible/reservable (`EN_STOCK` o `DISPONIBLE`);
3. validar `stockAvailable >= quantity`;
4. decrementar `stockAvailable` de forma atómica;
5. crear `CustomerOrderInventoryAllocation(ACTIVE)`.

El `stock` físico no cambia todavía.

### 5.2 Ítem ON_DEMAND

No crea `Product` placeholder.

Cuando llega el equipo:

1. se registra el `Product` por el flujo normal de compras/stock;
2. se vincula al `CustomerOrderItem.fulfilledProductId`;
3. se crea una allocation ACTIVE;
4. se decrementa `stockAvailable`.

### 5.3 Cancelación

Toda allocation `ACTIVE` se cambia a `RELEASED` y devuelve la cantidad a `stockAvailable`.

### 5.4 Conversión

Toda allocation `ACTIVE` se cambia a `CONSUMED` y:

- decrementa `stock`;
- no vuelve a decrementar `stockAvailable`;
- actualiza `Product.state` cuando corresponda (`VENDIDO` para teléfono sin stock; `FUERA_DE_STOCK` para accesorio).

---

## 6. Reglas de pago

### 6.1 Seña mínima

Configuración de tenant:

- `customerOrderMinimumDepositUsd` default: 100 USD.

Para crear un pedido confirmado:

- el total cubierto por pagos debe ser > 0;
- si no se paga el total, debe cubrir como mínimo la seña configurada;
- el pago nunca puede cubrir más que el total acordado (tolerancia USD 0.01).

### 6.2 Pricing

Todos los pagos pasan por:

- `getPaymentPricingSettings()`
- `getBlueSellRateSnapshot()` si existe ARS
- `priceNativePayment()`
- `buildPaymentPricingSnapshot()`

El saldo de pedido se calcula con `coveredBaseUsd`, no con `amountUsd`.

### 6.3 Caja

Por cada pago monetario:

- validar cuenta activa y accesible para la sucursal;
- validar moneda cuenta == moneda pago;
- bloquear si la fecha operativa de la sucursal está cerrada;
- crear `CashMovement(INCOME, CUSTOMER_ORDER_PAYMENT)`;
- `sourceType = CUSTOMER_ORDER_PAYMENT`;
- `sourceId = CustomerOrderPayment.id`.

`PLAN_CANJE` no genera movimiento monetario de Caja.

---

## 7. Cliente

Para crear un Pedido se exige un `Buyer` existente.

Además de las validaciones generales de Buyer, Pedido exige:

- nombre;
- apellido para persona física;
- DNI para minorista;
- teléfono;
- email.

No se vuelve obligatorio teléfono/email globalmente en `Buyer` para evitar romper datos históricos.

---

## 8. Endpoints

### Pedidos

```text
GET  /api/customer-orders
POST /api/customer-orders
GET  /api/customer-orders/:id
PATCH /api/customer-orders/:id
```

`POST` crea pedido + items + allocations + pagos + movimientos de Caja en una transacción.

### Pagos

```text
POST /api/customer-orders/:id/payments
```

Solo acepta pedidos no terminales.

### Estado operativo

```text
POST /api/customer-orders/:id/status
```

Body: `{ status }`.

`CONVERTED` no se permite aquí.

### Asignación de producto físico

```text
POST /api/customer-orders/:id/items/:itemId/allocate
```

Body: `{ productId, unitCostUsd? }`.

Vincula el producto recibido y bloquea disponibilidad.

### Conversión a venta

```text
POST /api/customer-orders/:id/convert
```

Genera la venta definitiva y consume allocations.

### Configuración

```text
GET   /api/customer-orders/settings
PATCH /api/customer-orders/settings
```

ADMIN únicamente para PATCH.

---

## 9. Transacciones críticas

### 9.1 Crear pedido

Dentro de `prisma.$transaction`:

1. validar Buyer;
2. resolver sucursal;
3. crear header;
4. crear items;
5. bloquear disponibilidad para items STOCK;
6. crear pagos con pricing ya resuelto;
7. crear movimientos de Caja;
8. recalcular `amountPaidUsd/balanceDueUsd`;
9. registrar AuditLog.

La consulta externa de TC ocurre **antes** de abrir la transacción.

### 9.2 Agregar pago

1. obtener snapshot de TC fuera de transacción;
2. validar pedido activo;
3. crear pago;
4. crear CashMovement;
5. recalcular totales;
6. AuditLog.

### 9.3 Asignar producto recibido

1. lock lógico mediante update condicional de stock disponible;
2. vincular `fulfilledProductId`;
3. persistir costo real;
4. crear allocation;
5. AuditLog.

### 9.4 Cancelar

1. marcar pedido CANCELLED;
2. liberar todas las allocations activas;
3. no borrar pagos ni movimientos;
4. cualquier devolución futura debe resolverse mediante reversa financiera explícita, no eliminando movimientos;
5. AuditLog.

### 9.5 Convertir a venta

1. validar READY_FOR_DELIVERY;
2. validar productos físicos y costos;
3. validar allocations;
4. crear Sale;
5. crear SaleItems;
6. copiar CustomerOrderPayment -> Payment;
7. consumir allocations / stock físico;
8. marcar pedido CONVERTED;
9. AuditLog;
10. no crear nuevos CashMovement.

---

## 10. RBAC

| Acción | ADMIN | VENDEDOR | STOCK | SOCIO |
|---|---:|---:|---:|---:|
| Listar pedidos | Sí | Sí | lectura logística opcional | Sí lectura |
| Crear pedido | Sí | Sí | No | No |
| Agregar pago | Sí | Sí | No | No |
| Cambiar estado comercial | Sí | Sí | limitado | No |
| Asignar producto recibido | Sí | Sí | Sí | No |
| Cancelar | Sí | No | No | No |
| Convertir a venta | Sí | Sí | No | No |
| Configurar seña/plazo | Sí | No | No | No |

En esta rama la API de mutación se restringe a ADMIN/VENDEDOR salvo allocation, que además permite STOCK.

---

## 11. UI interna

Nueva sección `Pedidos` en Comercial:

```text
/dashboard/customer-orders
/dashboard/customer-orders/new
/dashboard/customer-orders/:id
```

Listado mínimo:

- número;
- fecha;
- cliente;
- vendedor;
- estado;
- total;
- pagado;
- saldo;
- fecha estimada.

Alta:

1. cliente;
2. datos comerciales;
3. carrito mixto stock/on-demand;
4. pagos;
5. confirmación.

Detalle:

- timeline de estado;
- items;
- asignaciones;
- pagos;
- total/saldo;
- fecha estimada;
- acciones permitidas;
- vista imprimible de comprobante de pedido.

El comprobante de pedido **no incluye garantía**.

---

## 12. Comprobante

Debe incluir:

- branding tenant;
- número de pedido;
- fecha;
- cliente y DNI;
- teléfono/email;
- vendedor;
- sucursal;
- origen;
- detalle de items;
- pagos realizados con método, moneda, TC y cuotas;
- total acordado;
- total cubierto;
- saldo pendiente expresado en USD efectivo/base;
- fecha estimada;
- disclaimer configurable;
- espacio de firma.

La generación por email queda preparada como evolución futura; no forma parte de esta rama.

---

## 13. E-commerce futuro (fuera de alcance de implementación actual)

La capa de dominio queda preparada para:

### Fase 1

Catálogo público on-demand + selección/derivación a vendedor disponible por Instagram.

### Fase 2

Relación Buyer-vendedor, vendedor preferido, perfil comercial y citas virtuales.

### Fase 3

Checkout y pago directo desde e-commerce con idempotencia, webhooks y reconciliación.

No se expone `Product` ni `User` interno directamente a la API pública. Se crearán proyecciones públicas (`OnDemandOffer`, `SellerProfile`, `CustomerAccount`) cuando se implemente esa fase.

---

## 14. Archivos previstos

### Crear

```text
docs/customer-orders-on-demand-spec.md
prisma/migrations/20260818220000_customer_orders_on_demand/migration.sql
src/lib/domain/customer-orders.ts
src/app/api/customer-orders/route.ts
src/app/api/customer-orders/[id]/route.ts
src/app/api/customer-orders/[id]/payments/route.ts
src/app/api/customer-orders/[id]/status/route.ts
src/app/api/customer-orders/[id]/items/[itemId]/allocate/route.ts
src/app/api/customer-orders/[id]/convert/route.ts
src/app/api/customer-orders/settings/route.ts
src/app/dashboard/customer-orders/page.tsx
src/app/dashboard/customer-orders/new/page.tsx
src/app/dashboard/customer-orders/new/CustomerOrderForm.tsx
src/app/dashboard/customer-orders/[id]/page.tsx
src/components/customer-orders/CustomerOrderDetail.tsx
```

### Modificar

```text
prisma/schema.prisma
src/lib/config/settings.ts
src/lib/navigation/dashboard-navigation.ts
.github/workflows/validate-feature.yml
```

`WholesaleOrder` y sus rutas no se modifican.

---

## 15. Criterios de aceptación / UAT

### UAT-CO-01 — Pedido on-demand sin Product

Crear pedido de iPhone no existente físicamente. Debe persistir sin crear un `Product` placeholder.

### UAT-CO-02 — Carrito mixto

Agregar iPhone on-demand + fuente + funda en stock. Al confirmar:

- stock físico de accesorios no cambia;
- `stockAvailable` sí disminuye;
- otros vendedores no pueden comprometer esa cantidad.

### UAT-CO-03 — Seña mínima

Con total USD 1.800 y mínimo USD 100:

- USD 50 => bloqueado;
- USD 100 => permitido;
- USD 1.800 => permitido y estado de pago PAID.

### UAT-CO-04 — Pricing multimoneda

Registrar seña mediante ARS/transferencia/BNA y verificar snapshots, `coveredBaseUsd`, TC y saldo.

### UAT-CO-05 — Caja

El pago debe crear exactamente un ingreso en la cuenta seleccionada con origen CUSTOMER_ORDER_PAYMENT.

### UAT-CO-06 — Caja cerrada

Intentar cobrar un pedido en una fecha cerrada para la sucursal. Debe bloquearse.

### UAT-CO-07 — Cancelación

Cancelar pedido con accesorios asignados. Debe restaurarse `stockAvailable` sin borrar pagos ni movimientos históricos.

### UAT-CO-08 — Recepción producto on-demand

Crear el Product físico y asignarlo al item. Debe disminuir `stockAvailable` y guardar costo real.

### UAT-CO-09 — Conversión

Con todos los productos asignados y pedido READY_FOR_DELIVERY:

- crear Sale y SaleItems;
- copiar pagos;
- no duplicar CashMovement;
- consumir stock;
- pedido queda CONVERTED.

### UAT-CO-10 — Margen

Antes de conocer costo on-demand no se presenta margen definitivo. La Sale final usa el costo real persistido en el item/producto.

### UAT-CO-11 — Cliente incompleto

Buyer sin teléfono o email: bloquear creación del pedido con mensaje claro sin modificar las reglas globales de Buyer.

### UAT-CO-12 — RBAC

- VENDEDOR crea/cobra/convierte;
- STOCK solo participa en asignación logística autorizada;
- SOCIO no muta;
- ADMIN controla configuración y cancelación.

### UAT-CO-13 — Comprobante

Imprimir pedido y verificar que contiene items, pagos, saldo, fecha estimada, disclaimer y firma, sin garantía.

### UAT-CO-14 — WholesaleOrder legacy

Todas las rutas y modelos `WholesaleOrder` deben seguir compilando y funcionando sin modificaciones.

---

## 16. Definition of Done

La rama está lista para revisión cuando:

- Prisma schema y migración son aditivos;
- `WholesaleOrder` no fue modificado;
- `prisma validate` pasa;
- `prisma generate` pasa;
- TypeScript pasa sin errores;
- lint pasa;
- build pasa;
- pruebas de dominio/validación agregadas pasan;
- CI del branch está verde;
- el PR documenta riesgos, migración y UAT manual pendiente.
