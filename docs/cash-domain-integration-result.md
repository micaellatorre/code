# Cash domain integration result

## Recursive audit summary

Audited areas:

- src/app/api/sales, dashboard/sales and components/sales
- src/app/api/reservations, dashboard/reservations and components/reservations
- src/app/api/purchases, dashboard/purchases and purchase domain services
- src/app/api/commissions and commission domain services
- src/app/api/service-orders and service order domain services
- src/app/api/appointments, wholesale-orders, trade-in, products and cost-profiles
- src/lib/domain/cash, auth, tenant and branch context helpers
- scripts and Prisma schema/migrations

## Financial event matrix

| Module | Entity | Action | Moves cash | Direction | Category | Source | Date | Branch | Account selector |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Sales | Payment | create monetary payment | yes | INCOME | SALE_PAYMENT | SALE_PAYMENT / Payment.id | Payment.paidAt | Sale.branchId | required except PLAN_CANJE |
| Sales | Payment | edit financial fields | yes | reversal + INCOME | REVERSAL + SALE_PAYMENT | Payment.id | old/new paidAt | Sale.branchId | required |
| Sales | Payment | delete payment | yes | reversal | REVERSAL | Payment.id | reversal createdAt | original branch | n/a |
| Sales | PLAN_CANJE | create/edit | no | n/a | n/a | n/a | n/a | n/a | no |
| Reservations | ReservationPayment | create deposit | yes | INCOME | RESERVATION_DEPOSIT | RESERVATION_PAYMENT / ReservationPayment.id | paidAt | Reservation.branchId | required |
| Reservations | convert to Sale | copy deposit | no duplicate | n/a | n/a | originReservationPaymentId | original paidAt | Reservation.branchId | inherited |
| Purchases | PurchasePayment | create payment | yes | EXPENSE | PURCHASE_PAYMENT | PURCHASE_PAYMENT / PurchasePayment.id | paidAt | Purchase.branchId | required |
| Commissions | CloserCommission | mark PAID | yes | EXPENSE | COMMISSION_PAYMENT | CLOSER_COMMISSION / CloserCommission.id | paidAt | Sale.branchId | required |
| Service | ServiceOrder | DELIVERED | no | n/a | n/a | n/a | n/a | n/a | no payment entity exists |
| Appointments | Appointment | create/update | no | n/a | n/a | n/a | n/a | n/a | no |
| Wholesale | WholesaleOrder | lead/order | no | n/a | n/a | n/a | n/a | n/a | no |
| Trade-in | PLAN_CANJE credit | sale compensation | no | n/a | n/a | n/a | n/a | n/a | no |

## Implemented integrations

- Added nullable cashAccountId to Payment, ReservationPayment, PurchasePayment and CloserCommission.
- Added nullable Reservation.branchId for operational branch attribution.
- Added Payment.originReservationPaymentId to prevent ReservationPayment deposits from being posted twice after conversion to Sale.
- Added domain posting helpers in src/lib/domain/cash.ts for sale, reservation, purchase and commission payments.
- Automatic domain postings are idempotent by active sourceType/sourceId and correct by reversal + replacement.
- Cash account catalog is readable by operational roles for payment forms, while Cash mutations remain ADMIN-only.
- Sales, reservation and purchase forms now collect the target cash account for monetary payments.
- Manual duplicate from Caja pre-fills the new movement form only for manual movements.

## Explicit non-integrations

- ServiceOrder has priceAmount/costAmount/status but no persisted payment event. No CashMovement is generated from DELIVERED.
- Appointment does not post to Caja. Deposits are handled only by ReservationPayment.
- WholesaleOrder does not post to Caja unless it becomes Sale/Payment.
- Cancellation of sales/reservations does not imply refund.

## Backfill

Script:

```bash
npm run backfill:cash-history -- --account-id <CASH_ACCOUNT_ID> --dry-run
npm run backfill:cash-history -- --account USD=<USD_ACCOUNT_ID> --account ARS=<ARS_ACCOUNT_ID> --account USDT=<USDT_ACCOUNT_ID> --audit-only
```

The script processes Sale Payment and PurchasePayment sources, skips PLAN_CANJE, detects MATCHED/MISSING/DUPLICATED/REVERSED/ORPHAN, reports unresolved branches, currency mismatch, closed dates and ARS records without amountUsd.
