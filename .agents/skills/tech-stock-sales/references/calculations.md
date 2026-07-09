# TECH-STOCK Sales Calculations

Source: `prisma/schema.prisma`, `src/app/api/sales/route.ts`, `src/lib/domain/money.ts`.

`SaleItemKind`:

- `NORMAL`: common line, contributes `units * unitPrice` to subtotal.
- `ZERO_COST`: gift line, lowers stock and has `lineTotal = 0`.
- `IN_TOTAL`: cost-in-total line, lowers stock and adds cost to `Sale.extraCosts`; `lineTotal = 0`.

Sale item fields:

- `lineTotal`: for `NORMAL`, `units * unitPrice`; otherwise `0` in current API flow.
- `lineCost`: `units * (unitCost + extraCost)`.
- `lineProfit`: `lineTotal - lineCost`.
- `extraCost`: per-unit extra from selected cost profile or request.

Sale totals:

- `subtotal`: sum of NORMAL line totals.
- `costTotal`: sum of item line costs.
- `extraCosts`: sum of IN_TOTAL line costs and relevant extras.
- `total`: `subtotal + extraCosts`.
- `profit`: `total - costTotal`.
- `amountPaid`: total payment amount in current sales API flow.
- `balanceDue`: `total - amountPaid`.

Payments:

- `Payment` stores `currency`, `amount`, optional `exchangeRate` and optional `amountUsd`.
- `normalizeAmountUsd` returns amount for USD/USDT, converts ARS by `amount / exchangeRate` when exchange rate is positive, otherwise returns null.
- Do not treat raw payment amounts in different currencies as directly comparable unless the domain code normalizes them.
