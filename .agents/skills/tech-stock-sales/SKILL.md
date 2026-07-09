---
name: tech-stock-sales
description: Work on TECH-STOCK Sale, SaleItem, Payment, sales forms, item selection, reservations, trade-in devices, branch assignment, closer commissions, stock effects, and cash/payment calculations. Use for sales domain changes; do not use for unrelated UI-only tasks.
---

# TECH-STOCK Sales

Before modifying sales:

1. Review sales API routes.
2. Review the form and item selector.
3. Review payments, reservations, branch, closer, commissions, trade-in and cash integration.
4. Read `references/calculations.md` for financial invariants.

Rules:

- Server recalculates financial totals.
- Do not sum ARS, USD and USDT directly.
- Preserve `SaleItemKind` behavior.
- Preserve accessories linked through `parentItemId`.
- Confirming a sale must consider stock availability and Prisma transaction boundaries.
- Keep backend authorization with `requireRoleApi`; UI visibility is not enough.
