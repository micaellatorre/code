# TECH-STOCK Inventory Lifecycle

Source: `prisma/schema.prisma`, `src/lib/domain/purchases.ts`, `src/app/api/sales/route.ts`.

`ProductType` values are `PHONE` and `ACCESSORY`.

`ProductStatus` values are `AVAILABLE`, `UNAVAILABLE` and `DISCONTINUED`.

`ProductState` values are `EN_STOCK`, `EN_CAMINO`, `EN_REPARACION`, `CON_CLIENTE`, `DISPONIBLE`, `FUERA_DE_STOCK`, `VENDIDO` and `EN_REVISION`.

PHONE:

- Purchases create one `Product` per unit.
- Purchase flow requires IMEI for phone units and validates duplicated IMEIs within tenant.
- Created phone stock uses `stockInitial = 1`, `stock = 1`, `stockAvailable = 1`, `state = EN_STOCK`, `status = AVAILABLE`, and `branchId` from the purchase branch.
- Sales confirm only products in `EN_STOCK` or `DISPONIBLE`.
- Reservations allow `EN_STOCK` or `EN_CAMINO`.
- Confirmed sale decrements `stock` and `stockAvailable`; when stock drops below 1, phone state becomes `VENDIDO`.
- Trade-in creates PHONE products in `EN_REVISION` with `stockInitial = 1`, `stock = 1`, `stockAvailable = 0`.

ACCESSORY:

- Purchases create one Product lot with `stockInitial`, `stock` and `stockAvailable` equal to quantity.
- Confirmed sale decrements stock fields by quantity.
- When stock drops below 1, accessory state becomes `FUERA_DE_STOCK`.

Location:

- `branchId` relates Product to Branch and is the normalized location for new operations.
- `location` remains a legacy free-text field.
