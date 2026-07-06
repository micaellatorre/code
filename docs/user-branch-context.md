# User Branch Context

## Conceptos

### User.currentBranchId

Sucursal donde el usuario esta operando actualmente. Se usa como contexto por defecto para nuevas operaciones cuando el rol efectivo no puede elegir sucursal manualmente.

### UserBranchCoverage

Conjunto de sucursales que un usuario puede seleccionar como contexto operativo. No representa historial de venta, registro de buyer ni ubicacion fisica de producto.

### Product.branchId

Ubicacion fisica actual del producto.

### Sale.branchId

Sucursal donde ocurrio la operacion comercial.

## Effective coverage

ADMIN tiene cobertura efectiva sobre todas las sucursales activas del tenant. La app intenta persistir esas filas en `UserBranchCoverage`, pero el helper defensivo tambien devuelve todas las activas aunque falte alguna fila.

Otros roles solamente pueden seleccionar sucursales activas incluidas en `UserBranchCoverage`.

## Current branch selection

`GET /api/users/me/branches` devuelve la sucursal actual y las sucursales seleccionables. `PATCH /api/users/me/current-branch` cambia solo la sucursal del usuario autenticado.

## Product creation

ADMIN puede enviar `branchId`; si no lo envia se usa su sucursal actual/fallback seleccionable. Otros roles usan `User.currentBranchId` y no pueden forzar otro `branchId`.

## Sale creation

ADMIN puede enviar `branchId`; VENDEDOR usa su sucursal actual. No se infiere desde Buyer.

## Product branch transfer

Solo ADMIN efectivo puede cambiar `Product.branchId`. Registra `AuditLog` con `BRANCH_TRANSFER / PRODUCT`.

## Sale branch change

Solo ADMIN efectivo puede cambiar `Sale.branchId` cuando la venta es editable por la politica existente. Registra `AuditLog` con `UPDATE / SALE`.

## Role simulation

La UI y backend usan `session.user.activeRole`. Un ADMIN simulando VENDEDOR ve permisos de VENDEDOR para asignacion manual de sucursal. El actor real sigue siendo el usuario autenticado.

## Legacy/backfill

El backfill de sucursal principal asigna todos los Product y Sale del tenant de la sucursal target a esa sucursal y crea contexto/coberturas iniciales de usuarios.

## Main branch backfill

Sucursal default documentada: `cmr8mxgy100007chhk3ctz7zp`. El script permite sobreescribir con `--branch-id`.

## Tenant isolation

Toda seleccion de sucursal valida tenant, branch activa y cobertura efectiva. Los endpoints administrativos validan que usuario objetivo y sucursales pertenezcan al mismo tenant.

## Deployment order

1. Revisar `docs/user-branch-context-migration.sql`.
2. Crear/aplicar migracion aditiva con Prisma.
3. Ejecutar `npx prisma generate`.
4. Deploy backend compatible con `currentBranchId = null`.
5. Ejecutar `npm run backfill:main-branch -- --branch-id cmr8mxgy100007chhk3ctz7zp --dry-run`.
6. Revisar cantidades.
7. Ejecutar `npm run backfill:main-branch -- --branch-id cmr8mxgy100007chhk3ctz7zp`.
8. Verificar Product, Sale, User y cobertura ADMIN.
9. Deploy/verificar UI.
