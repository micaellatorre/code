---
name: tech-stock-inventory
description: Work on TECH-STOCK Product, stock, inventory lifecycle, IMEI, branch location, ProductStatus/ProductState, reservations, sales, purchases, service orders, and trade-in behavior. Use for inventory domain changes; do not use for unrelated UI-only tasks.
---

# TECH-STOCK Inventory

Read `prisma/schema.prisma` and relevant product/sales/purchase/service/trade-in code before changing inventory logic.

Read `references/lifecycle.md` when the task touches Product lifecycle, PHONE vs ACCESSORY stock, branch location, IMEI, stock fields or state/status transitions.

Core rules:

- PHONE is an atomic unit.
- PHONE normally has `stockInitial = 1`, `stock = 1` or `0` by lifecycle, and coherent `stockAvailable`.
- PHONE uses one IMEI per unit when current workflow requires it.
- `branchId` is normalized location; `Product.location` is legacy for new operations.
- ACCESSORY is quantitative and can preserve historical lots.
- Do not sell products in non-sellable states.
- Do not change lifecycle from a single endpoint in isolation.

Always review `ProductStatus`, `ProductState`, sales, reservations, purchases, service orders and trade-in impact.
