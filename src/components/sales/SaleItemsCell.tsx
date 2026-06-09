"use client"

import Link from "next/link"
import { DevicePhoneMobileIcon, ShoppingBagIcon } from "@heroicons/react/24/outline"
import type { SaleItemSummary } from "./types"

function TypeIcon({ type }: { type: string }) {
  return type.toUpperCase() === "PHONE" ? <DevicePhoneMobileIcon className="size-4 shrink-0 mt-1" /> : <ShoppingBagIcon className="size-4 shrink-0 mt-1" />
}

function ItemLine({ item }: { item: SaleItemSummary }) {
  const product = item.product
  const details = [
    product.capacityGB ? `${product.capacityGB}GB` : null,
    product.color,
    product.condition,
    product.batteryPct ? `${product.batteryPct}% bat.` : null,
    product.imei ? `IMEI ${product.imei.slice(-4)}` : null,
    product.type?.toUpperCase() === "ACCESSORY" ? `x${item.units}` : null,
  ].filter(Boolean)

  return (
    <Link href={`/dashboard/products/${item.productId}/edit`} className="flex min-w-56 gap-2 rounded-md p-2 hover:bg-base-200">
      <TypeIcon type={product.type ?? ""} />
      <span className="min-w-0">
        <span className="block truncate font-medium">{product.modelName}</span>
        <span className="block text-xs text-base-content/60">{details.join(" · ") || "Sin detalle"}</span>
      </span>
    </Link>
  )
}

export default function SaleItemsCell({ items }: { items: SaleItemSummary[] }) {
  if (!items.length) return <span className="text-base-content/50">Sin items</span>

  const visible = items.slice(0, 1)
  const hidden = items.slice(1)

  return (
    <div className="flex flex-col gap-1 p-2 border border-base-300 rounded-lg bg-base-200 w-auto">
      {visible.map((item) => (
        <ItemLine key={item.id} item={item} />
      ))}
      {hidden.length ? (
        <div className="dropdown dropdown-hover">
          <button type="button" tabIndex={0} className="btn btn-ghost btn-xs w-fit">
            +{hidden.length} mas
          </button>
          <div tabIndex={0} className="dropdown-content z-20 w-72 rounded-lg border border-base-300 bg-base-100 p-2 shadow-lg">
            {hidden.map((item) => (
              <ItemLine key={item.id} item={item} />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}
