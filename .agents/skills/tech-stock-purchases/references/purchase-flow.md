# TECH-STOCK Purchase Flow

Source: `prisma/schema.prisma`, `src/lib/domain/purchases.ts`, `src/lib/domain/suppliers.ts`, `src/app/api/purchases/route.ts`.

Supplier coverage:

- Suppliers have a primary `branchId`.
- Suppliers can also have `SupplierBranchCoverage` rows.
- `assertSupplierCoversBranch` accepts a supplier only if it belongs to the tenant and either its primary branch or a coverage matches the purchase branch.

Purchase:

- `Purchase` belongs to tenant and supplier.
- Purchase stores `date`, `currency`, `totalCost`, optional `branchId`, notes, items and payments.
- Current create route allows `ADMIN` and `STOCK`.

PHONE purchase:

- Requires one IMEI per unit in current domain flow.
- Validates IMEI format and duplicate IMEIs within tenant.
- Creates one Product per unit with `type = PHONE`, `brand = Apple`, `state = EN_STOCK`, `status = AVAILABLE`, stock fields set to 1, `branchId` from purchase branch and `origin` from supplier name.
- Creates one `PurchaseItem` per created Product with `units = 1`.

ACCESSORY purchase:

- Creates one Product lot with quantity in `stockInitial`, `stock` and `stockAvailable`.
- Creates one `PurchaseItem` for that Product with `units = quantity`.

Payments:

- `PurchasePayment` stores `method`, `currency`, `amount`, optional `exchangeRate` and optional `amountUsd`.
- Amount USD is normalized with the money helper.

Audit:

- Purchase creation logs `CREATE`.
- Each purchase payment logs `PAYMENT_CREATED`.
- Stock intake logs `STOCK_CHANGE`.
- Admin simulation metadata is persisted when the real role is ADMIN and active role is simulated.
