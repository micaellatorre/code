Implementé la reingeniería de Caja de punta a punta en una versión funcional e incremental, sin db push, sin migrate reset y sin aplicar migraciones a datos.
1. Resumen ejecutivo
Caja ahora tiene pantalla propia en /dashboard/cash, ledger por CashMovement, saldos nativos calculados, scope de cuentas TENANT/BRANCH, sucursal operativa en movimientos/transferencias, reversas explícitas, conversiones con snapshots FX, cierre diario, export PDF HTML imprimible y RBAC backend.
2. Auditoría del módulo anterior
Antes: lib/domain/cash.ts concentraba cuenta/movimiento/transferencia; APIs eran principalmente POST; Caja vivía como tab en Database; no había branchId en ledger; reversa usaba sourceId; no encontré integraciones reales llamando createCashMovement desde ventas/reservas/compras/servicio. Esos pagos siguen como legacy read model en Database.
3. Cambios Prisma
Model	Campo/relación	Motivo
CashAccount	scope, branchId, sortOrder	cuentas globales o de sucursal
CashMovement	branchId, reversalOfId	imputación por sucursal y reversas explícitas
CashTransfer	branchId, kind, FX snapshots	transferencias vs conversiones
CashDailyClose	nuevo modelo	cierre diario inmutable
CashDailyCloseAccountSnapshot	nuevo modelo	saldos al momento del cierre
AuditAction	CASH_CLOSE	auditoría semántica

4. ER final de Caja
Tenant tiene CashAccount, CashMovement, CashTransfer, CashDailyClose.
Branch se relaciona con cuentas branch-scoped, movimientos, transferencias y cierres.
User crea movimientos/transferencias y puede cerrar caja.
CashDailyClose contiene snapshots por CashAccount.
5-12. Dominio
CashAccount.scope: TENANT es global con branchId=null; BRANCH exige sucursal por validación backend.
CashMovement.branchId: sucursal responsable de la imputación, aunque la cuenta sea global.
Ledger: saldo = ingresos nativos menos egresos nativos; no agregué CashAccount.balance.
Reversas: crean contraasiento con reversalOfId; no mutan el original y bloquean doble reversa.
Conversión: CashTransfer CONVERSION recalcula toAmount en backend y crea dos movimientos en transacción.
Informe cambiario: usa benchmarkExchangeRate, theoreticalAmountUsd, realAmountUsd, fxResultUsd.
Promedio ponderado ARS: implementado sobre movimientos ARS históricos con amountUsd; no usa dólar actual retroactivo.
Cierre diario: snapshot inmutable por sucursal/fecha, con bloqueo post-cierre para mutaciones de Caja.
13. UX/UI implementada
Nueva pantalla /dashboard/cash con header Caja, sucursal actual, cards por cuenta real, resumen diario USD equivalente, informe cambiario expandible, tabla de movimientos con filtros, widget de cierre y widget de export.
Actualicé formularios de movimiento/conversión y administración de cuentas para scope/sucursal/orden/estado.
14-18. APIs, servicios, RBAC y audit
APIs creadas/modificadas: /api/cash-movements GET/POST, /api/cash-accounts, /api/cash-accounts/[id], /api/cash/fx-report, /api/cash/daily-close, /api/cash/export, /api/cash-transfers.
Servicios principales en lib/domain/cash.ts: dashboard read model, balances, movimientos, reversas, transferencias, FX report, weighted basis y daily close.
Acción	ADMIN	SOCIO	VENDEDOR	STOCK
Ver Caja	sí	sí	no	no
Crear movimiento	sí	no	no	no
Conversión	sí	no	no	no
Reversa	sí	no	no	no
Cierre	sí	no	no	no
Export	sí	sí	no	no

También corté el payload financiero de Caja en Database para roles sin acceso.
19-20. Backfill y migración
Migración creada: 20260709120000_cash_ledger_reengineering. Es aditiva; la búsqueda precisa no encontró DROP, DELETE, TRUNCATE, DROP COLUMN ni SET NOT NULL.
Backfill creado:
npm run backfill:cash-branch -- --branch-id cmr8mxgy100007chhk3ctz7zp --dry-run
npm run backfill:cash-branch -- --branch-id cmr8mxgy100007chhk3ctz7zp
No ejecuté el backfill real.
21-22. Validaciones reales
Pasaron:
npx prisma format
npx prisma validate
npx prisma generate
npx tsc --noEmit
npm run lint
npm run build
Tests: no ejecuté tests porque package.json no tiene script test.
23. Archivos principales
Creados: app/dashboard/cash/page.tsx, components/cash/CashDashboard.tsx, APIs bajo app/api/cash/*, scripts/backfill-cash-branch.ts, migración SQL, docs/cash-ledger-reengineering.md.
Modificados: schema.prisma, lib/domain/cash.ts, navegación, formularios de Caja, administración de cuentas, Database read model/export guard.
24. Pendientes reales
No agregué suite de tests automatizados porque el repo no tiene infraestructura de test configurada.
No migré pagos históricos de ventas/reservas/compras/servicio a CashMovement; quedaron como legacy read model, que era el estado real auditado.
La conversión usa la página/form existente en vez de modal in-place.