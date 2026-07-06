# CRUD and Domain Gaps

## Payments no tienen cuenta de caja

Problema: `Payment`, `PurchasePayment` y `ReservationPayment` no poseen `cashAccountId`.

Impacto actual: las tablas pueden mostrar pagos legacy y movimientos de caja, pero no hay conciliacion directa obligatoria entre pago comercial y cuenta real.

Solucion implementada temporalmente: `CashMovement` permite movimientos manuales y la vista Caja incluye pagos legacy como read model.

Cambio de schema recomendado: agregar relaciones opcionales desde pagos a `CashAccount` o un proceso de conciliacion.

Prioridad: Alta

## CashMovement no tiene reversedMovementId

Problema: el schema permite crear una reversa con `sourceId`, pero no tiene una relacion explicita al movimiento revertido.

Impacto actual: la reversa preserva historial, aunque la integridad de "una sola reversa por movimiento" no queda garantizada por constraint.

Solucion implementada temporalmente: `reverseCashMovement` crea movimiento opuesto con `category = REVERSAL` y `sourceId = original.id`.

Cambio de schema recomendado: `reversedMovementId String?` con relacion e indice unico parcial si aplica.

Prioridad: Media

## Purchase no tiene status

Problema: una compra no distingue estados operativos como abierta, recibida, cancelada o consolidada.

Impacto actual: no se implementa cancelacion/reversa compleja de compras.

Solucion implementada temporalmente: se permite crear compra con pagos multiples y se mantiene listado/read model.

Cambio de schema recomendado: agregar `PurchaseStatus`.

Prioridad: Media

## Reservation no tiene branchId

Problema: una reserva no puede registrar sucursal propia.

Impacto actual: se puede reservar producto, pero la sucursal se infiere desde `Product.branchId` o `Product.location`.

Solucion implementada temporalmente: el item de reserva referencia producto cuando existe.

Cambio de schema recomendado: agregar `Reservation.branchId String?`.

Prioridad: Media

## CostProfile no tiene isActive

Problema: los perfiles usados historicamente no pueden desactivarse sin borrar.

Impacto actual: no se implemento baja semantica completa para perfiles usados por ventas.

Solucion implementada temporalmente: se documenta la restriccion y no se elimina si esta usado.

Cambio de schema recomendado: agregar `isActive Boolean @default(true)`.

Prioridad: Baja

## CloserCommission no tiene cashAccountId

Problema: marcar una comision como pagada no puede asociar salida de caja.

Impacto actual: `PAID` actualiza `paidAt`, pero no genera `CashMovement` automatico.

Solucion implementada temporalmente: se documenta gap y se permite registrar egreso manual de caja.

Cambio de schema recomendado: agregar cuenta de pago o flujo de conciliacion con `CashMovement`.

Prioridad: Media
