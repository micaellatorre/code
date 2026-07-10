<!-- Migracion de conceptos relacionados a Caja -->

# Cash Ledger Reengineering
## Domain concepts

### CashAccount

CashAccount represents where money is held. It does not store balance. Balance is always derived from CashMovement.

### CashMovement

CashMovement is the immutable operational ledger entry. It records native amount, direction, account, operational branch and optional historical USD equivalent.

### CashTransfer

CashTransfer represents one atomic operation between two accounts. It creates exactly two CashMovement rows: one expense from the origin account and one income into the destination account.

### CashDailyClose

CashDailyClose is an immutable snapshot of one branch business day. It stores USD equivalent day flow and account snapshots at close time.

## Account scope

TENANT accounts are global financial accounts shared by the tenant. They must have branchId null.

BRANCH accounts belong to one physical branch. branchId is nullable in the database for compatibility, but required by backend validation when scope is BRANCH.

## Branch attribution

CashAccount.branchId says where the account belongs when it is a branch-scoped account.

CashMovement.branchId says which branch is operationally responsible for the movement. A TENANT account can receive a movement attributed to Villa Mercedes, San Luis, or another covered branch.

## Ledger balance

Native balance is calculated from movements:

```ts
balance = sum(direction === "INCOME" ? amount : -amount)
```

No CashAccount.balance exists.

## Native balance vs USD equivalent

amount is the native amount in the account currency.

amountUsd is a historical USD equivalent used only for consolidation, daily summary, reports and financial analysis.

ARS legacy movements without amountUsd are not converted with the current exchange rate.

## Movement categories

Manual movements accept operational categories such as ADJUSTMENT, EXPENSE, SERVICE_PAYMENT and COMMISSION_PAYMENT.

Transactional categories such as SALE_PAYMENT, PURCHASE_PAYMENT, TRANSFER, CONVERSION and REVERSAL are reserved for domain services.

## Manual movements

ADMIN can create manual movements. SOCIO is read-only. Backend assigns the current branch from User.currentBranchId through the branch context.

## Reversals

A reversal creates a new CashMovement with opposite direction, category REVERSAL and reversalOfId pointing to the original movement. The original movement is never modified.

Legacy reversal detection also checks old sourceId conventions so a historical movement cannot be reversed twice.

## Currency conversion

CashTransfer kind CONVERSION recalculates destination amount server-side from fromAmount and exchangeRate.

ARS to USD/USDT:

```ts
toAmount = fromAmount / exchangeRate
```

USD/USDT to ARS:

```ts
toAmount = fromAmount * exchangeRate
```

The operation is transactional and writes the transfer plus the two ledger entries atomically.

## ARS weighted cost basis

For ARS accounts, benchmarkExchangeRate is calculated from the historical ARS ledger before the conversion.

Formula:

```ts
weightedRate = remainingArsBasis / remainingUsdBasis
```

ARS income with amountUsd adds to both bases. ARS expense consumes proportional USD basis using the current weighted rate.

## FX result

For ARS to USD/USDT conversions:

```ts
theoreticalAmountUsd = fromAmount / benchmarkExchangeRate
realAmountUsd = toAmount
fxResultUsd = realAmountUsd - theoreticalAmountUsd
```

Positive result is gain. Negative result is loss. Zero is neutral.

## Daily close

Daily close snapshots the branch day. It stores incomeUsd, expenseUsd, netUsd and one CashDailyCloseAccountSnapshot per accessible account.

Snapshots are not recalculated when consulting historical closes.

## Closed business date rules

Manual movements, conversions, transfers and reversals are blocked after a branch business date is closed.

## Historical exchange rates

Historical amountUsd is preserved. Missing ARS equivalents remain missing and are surfaced as warnings.

## Legacy movements without amountUsd

USD and USDT legacy movements can fall back to native amount for USD equivalent summaries.

ARS legacy movements without amountUsd are excluded from precise USD totals and counted as unconverted.

## RBAC

ADMIN can view, create, convert, reverse, close, export and configure accounts.

SOCIO can view dashboards, movements, FX report, daily closes and exports. SOCIO cannot mutate.

VENDEDOR and STOCK do not receive full cash dashboard payloads.

## Role simulation

Routes use the effective activeRole from the auth helpers. ADMIN simulating SOCIO becomes read-only. ADMIN simulating VENDEDOR or STOCK is blocked from the full cash module.

## Migration

Migration `20260709120000_cash_ledger_reengineering` is additive:

- new enums CashAccountScope and CashTransferKind
- new fields on CashAccount, CashMovement and CashTransfer
- new CashDailyClose and CashDailyCloseAccountSnapshot tables
- new indexes and foreign keys
- new AuditAction CASH_CLOSE

## Cash branch backfill

Dry-run:

```bash
npm run backfill:cash-branch -- --branch-id cmr8mxgy100007chhk3ctz7zp --dry-run
```

Real run:

```bash
npm run backfill:cash-branch -- --branch-id cmr8mxgy100007chhk3ctz7zp
```

The script updates only CashMovement and CashTransfer rows with branchId null inside the target branch tenant. It does not modify CashAccount.

## Deployment order

1. Review migration SQL.
2. Apply additive migration.
3. Run prisma generate.
4. Deploy backend compatible with branchId null.
5. Run dry-run backfill.
6. Review counts and tenant.
7. Run real backfill.
8. Verify CashMovement.branchId.
9. Verify CashTransfer.branchId.
10. Configure CashAccount scope from ADMIN.
11. Deploy new Caja UI.
12. Verify account cards.
13. Verify today summary.
14. Register a manual movement.
15. Execute a conversion.
16. Verify FX report.
17. Close daily cash.
18. Verify post-close blocking.
19. Verify export PDF.
20. Verify SOCIO read-only.
21. Verify role simulation.

## Domain integrations

| Source | Evento financiero | Category | Direction | sourceId |
| --- | --- | --- | --- | --- |
| Payment | pago monetario venta | SALE_PAYMENT | INCOME | Payment.id |
| ReservationPayment | sena | RESERVATION_DEPOSIT | INCOME | ReservationPayment.id |
| PurchasePayment | pago compra | PURCHASE_PAYMENT | EXPENSE | PurchasePayment.id |
| Service payment | cobro servicio | SERVICE_PAYMENT | INCOME | payment/source id |
| CloserCommission | comision pagada | COMMISSION_PAYMENT | EXPENSE | CloserCommission.id |

Reglas aplicadas:

- PLAN_CANJE no mueve CashAccount. Es compensacion no monetaria e ingreso de inventario.
- Appointment no mueve Caja directamente. Si deriva en ReservationPayment, el asiento nace desde ReservationPayment.
- WholesaleOrder no mueve Caja como lead. Si se convierte a venta, Caja se integra desde Sale/Payment.
- Reservation -> Sale no duplica senas. El Payment copiado a la venta conserva originReservationPaymentId y no genera SALE_PAYMENT.
- Ediciones financieras usan reversa + reemplazo. Nunca se actualiza destructivamente CashMovement.
- Reassign account debe resolverse como reversa + reemplazo; desde la UI de Caja queda deshabilitado para asientos transaccionales y debe hacerse desde la entidad fuente para no desincronizar pagos.
- Cancelar Sale o Reservation no implica refund automatico. Solo se anula stock/estado; una devolucion real debe registrarse como evento monetario explicito.
- ServiceOrder no tiene todavia entidad persistida de pago. DELIVERED no se interpreta como cobro.
