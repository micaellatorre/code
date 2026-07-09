---
name: tech-stock-tables
description: Design, audit, or refactor TECH-STOCK operational tables for stock, sales, purchases, buyers, appointments, reservations, cash, service orders, and similar list workflows. Use for table UX/UI work; do not use for unrelated backend-only tasks.
---

# TECH-STOCK Tables

Table workflow:

1. Identify the scan objective.
2. Define the primary column.
3. Identify secondary metadata.
4. Limit badges to meaningful state.
5. Separate KPIs from the table.
6. Build a toolbar with segmentation/tabs when useful, search, filters and primary action.
7. Use clear headers.
8. Structure cells as primary, secondary and metadata.
9. Put row actions at the end.
10. Use icon buttons with tooltips.
11. Avoid action dropdowns when there are three or fewer frequent actions.
12. Keep destructive actions visually secondary.
13. Review truncation and optional columns.
14. Hide secondary metadata before critical data on responsive layouts.
15. Provide loading skeletons, contextual empty states and no-results states.
16. Add pagination when volume requires it.

Stock tables prioritize model, IMEI, capacity, condition, battery, state/status and location.

Sales tables prioritize date, buyer, items, seller/closer, branch, total and payment/status.

Purchases tables prioritize date, supplier, items, total, payment, tracking and actions.
