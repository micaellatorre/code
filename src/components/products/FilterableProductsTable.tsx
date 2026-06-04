// code/src/components/products/FilterableProductsTable.tsx
"use client"

import ProductsFiltersDrawer from "./ProductsFiltersDrawer"
import ProductTables from "./ProductTables"
import ProductsToolbar from "./ProductsToolbar"
import { useProductsInventory } from "./useProductsInventory"

export default function FilterableProductsTable() {
  const inventory = useProductsInventory()

  return (
    <div className="flex flex-col gap-2 sm:gap-4 !h-full flex-1 relative">
      <ProductsToolbar inventory={inventory} />
      <ProductsFiltersDrawer inventory={inventory} />
      <ProductTables inventory={inventory} />
    </div>
  )
}
