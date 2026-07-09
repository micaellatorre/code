---
name: tech-stock-purchases
description: Work on TECH-STOCK Supplier, Purchase, PurchaseItem, PurchasePayment, purchase forms, supplier coverage, stock creation, branch propagation, cash/audit integration, and purchase timelines. Use for purchases domain changes; do not use for unrelated backend-only or UI-only tasks.
---

# TECH-STOCK Purchases

Before modifying purchases:

1. Review suppliers, branches and supplier coverage.
2. Review purchases API, purchase forms, Product creation, cash and audit.
3. Read `references/purchase-flow.md` for current flow invariants.

Rules:

- A supplier is valid for a branch when `supplier.branchId === branchId` or `supplier.branchCoverages` contains the branch.
- PHONE purchases create individual Product rows per unit.
- ACCESSORY purchases create Product lots.
- `branchId` and purchase date must propagate consistently.
- Purchase creation must be transactional.
- `Purchase -> Product -> PurchaseItem` must not persist partially.
- Use existing `AuditLog` timeline. Do not create a parallel `PurchaseHistory` unless explicitly requested.
