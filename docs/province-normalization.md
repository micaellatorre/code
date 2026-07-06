# Normalizacion geografica argentina

TECH-STOCK usa un catalogo global `Province` con los 24 distritos argentinos y codigo AFIP/localflavor como `id` y `code`.

## Alcance

- `Buyer.province` y `Branch.province` quedan como campos legacy de texto libre.
- `Buyer.provinceId`, `Supplier.provinceId` y `Branch.provinceId` apuntan al catalogo normalizado.
- `Buyer.registeredBranchId` representa la sucursal comercial de registro del cliente.
- `Sale.branchId` sigue siendo la sucursal real de la venta.
- `BranchProvinceCoverage` define la cobertura comercial multi-provincia de cada sucursal.

## Operacion sugerida

1. Revisar el SQL generado en `docs/province-normalization-migration.sql`.
2. Aplicar la migracion con el procedimiento local habitual de Prisma.
3. Sembrar catalogo: `npm run seed:provinces`.
4. Auditar backfill sin cambios: `npm run backfill:provinces`.
5. Si el reporte es correcto, ejecutar `ts-node scripts/backfill-provinces.ts`.

El backfill solo vincula `Buyer` y `Branch` cuando encuentra match exacto por codigo, match exacto por nombre normalizado o alias controlado.
