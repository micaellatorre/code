# Base de Datos Module - Migration Notes

## Nuevos modelos

- `Branch`
- `PurchasePayment`
- `Reservation`
- `ReservationItem`
- `ReservationPayment`
- `ServiceOrder`
- `AuditLog`
- `CashAccount`
- `CashMovement`
- `CashTransfer`
- `CloserCommissionPlan`
- `CloserCommission`

## Nuevos campos opcionales

- `Product.branchId`
- `Sale.branchId`
- `Sale.closerId`
- `Sale.saleType`
- `Payment.exchangeRate`
- `Payment.amountUsd`
- `Purchase.branchId`

## Compatibilidad legacy

- `Product.senado`, `Product.senadoAt` y `Product.location` se conservan.
- `Sale.userId` se conserva como vendedor/creador legacy; `Sale.closerId` es opcional y no lo reemplaza.
- `Purchase.downPayment` se conserva como fallback de pagos de compras.
- `Buyer.type` sigue siendo fallback para resolver ventas minoristas/mayoristas cuando `Sale.saleType` es `null`.
- `Payment.exchangeRate` y `Payment.amountUsd` son opcionales; pagos historicos siguen funcionando sin backfill.

## Fallbacks de lectura

- Tipo de venta: `Sale.saleType` -> `Buyer.type` -> `MINORISTA`.
- Guardados: `Reservation` nueva + ventas legacy `Sale.status = SENADA` + productos legacy `Product.senado`.
- Caja: `CashMovement` nuevo + pagos legacy de ventas + `Purchase.downPayment`.
- Compras: `PurchasePayment.amountUsd` cuando exista; si no hay pagos nuevos, `Purchase.downPayment`.
- Ubicacion de producto: `Branch.name` -> `Product.location`.

## Riesgos

- El deploy de backend que consulta modelos nuevos requiere que la migracion aditiva ya este aplicada.
- `xlsx` agrega dependencias y `npm audit` reporta vulnerabilidades transitivas pendientes de evaluar.
- No se implemento backfill historico ni movimientos de caja retrospectivos.
- `AuditLog` es append-only a nivel de aplicacion; la proteccion SQL contra `UPDATE/DELETE` queda para una fase posterior.

## Orden recomendado de deploy

1. Generar y revisar migracion aditiva en un entorno local/staging.
2. Aplicar la migracion aditiva en base de datos.
3. Ejecutar `npx prisma generate`.
4. Deploy backend compatible.
5. Deploy frontend.
6. Crear nuevos datos exclusivamente mediante flujos nuevos.
7. Ejecutar backfills futuros en migraciones separadas y auditadas.

## Comandos manuales sugeridos

```bash
npx prisma migrate dev --create-only --name database_module
npx prisma migrate diff --from-schema <schema-anterior.prisma> --to-schema prisma/schema.prisma --script
npx prisma migrate deploy
npx prisma generate
```

No usar `prisma db push --accept-data-loss` ni `prisma migrate reset`.

## Verificacion post-deploy

- Confirmar que el SQL no contiene `DROP TABLE`, `DROP COLUMN` ni conversiones de tipo.
- Confirmar que ventas, compras, productos, citas, buyers, trade-in y cost profiles siguen cargando.
- Crear una venta de prueba y verificar un registro `AuditLog`.
- Abrir `/dashboard/database` con roles `ADMIN`, `SOCIO`, `VENDEDOR` y `STOCK`.
- Exportar Excel y verificar worksheets seleccionadas.
- Exportar PDF/print y verificar que no exponga campos restringidos.

## SQL diff inspeccionado

El diff local contra el schema anterior de git genero solamente:

- `CREATE TYPE`
- `ALTER TABLE ... ADD COLUMN`
- `CREATE TABLE`
- `CREATE INDEX`
- `ALTER TABLE ... ADD CONSTRAINT`

No se detectaron operaciones destructivas (`DROP TABLE`, `DROP COLUMN`, cambios de tipo o renombres directos).
