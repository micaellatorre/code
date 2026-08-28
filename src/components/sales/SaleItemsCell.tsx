"use client"

import Link from "next/link"
import { DevicePhoneMobileIcon, ShoppingBagIcon } from "@heroicons/react/24/outline"
import ImeiDisplay from "@/components/common/ImeiDisplay"
import ProductColorSwatch from "@/components/products/ProductColorSwatch"
import { getConditionLabel, getProductDisplayCapacity, getProductDisplayColor, getProductDisplayColorHex, getProductDisplayModel } from "@/lib/products/display"
import type { SaleItemSummary } from "./types"

function TypeIcon({ type }: { type: string }) {
  return type.toUpperCase() === "PHONE" ? <DevicePhoneMobileIcon className="size-4 shrink-0 mt-1" /> : <ShoppingBagIcon className="size-4 shrink-0 mt-1" />
}

function ItemLine({ item, nested = false }: { item: SaleItemSummary; nested?: boolean }) {
  const product = item.product
  const color = getProductDisplayColor(product)
  const capacity = product.type?.toUpperCase() === "PHONE" ? getProductDisplayCapacity(product) : null
  const details = [
    capacity,
    color ? (
      <span key="color" className="inline-flex items-center gap-1">
        <ProductColorSwatch hexColor={getProductDisplayColorHex(product)} title={color} />
        {color}
      </span>
    ) : null,
    getConditionLabel(product.condition),
    product.batteryPct ? `${product.batteryPct}% bat.` : null,
    product.type?.toUpperCase() === "ACCESSORY" ? `x${item.units}` : null,
  ].filter(Boolean)
  const detailNodes = [
    ...details,
    product.imei ? (
      <span key="imei" className="inline-flex items-baseline gap-1">
        IMEI <ImeiDisplay imei={product.imei} />
      </span>
    ) : null,
  ].filter(Boolean)

  return (
    <Link href={`/dashboard/products/${item.productId}/edit`} className="flex min-w-56 gap-2 rounded-md p-2 hover:bg-base-200">
      <TypeIcon type={product.type ?? ""} />
      <span className="min-w-0">
        {nested ? <span className="block text-[10px] font-medium uppercase text-accent">Accesorio sugerido</span> : null}
        <span className="block truncate font-medium">{getProductDisplayModel(product)}</span>
        <span className="block text-xs text-base-content/60">
          {detailNodes.length
            ? detailNodes.map((detail, index) => (
                <span key={index}>
                  {index > 0 ? " - " : null}
                  {detail}
                </span>
              ))
            : "Sin detalle"}
        </span>
      </span>
    </Link>
  )
}

function orderItems(items: SaleItemSummary[]) {
  const byId = new Set(items.map((item) => item.id))
  const childrenByParent = new Map<string, SaleItemSummary[]>()
  const roots: SaleItemSummary[] = []

  for (const item of items) {
    if (item.parentItemId && byId.has(item.parentItemId)) {
      childrenByParent.set(item.parentItemId, [...(childrenByParent.get(item.parentItemId) ?? []), item])
    } else {
      roots.push(item)
    }
  }

  const ordered: { item: SaleItemSummary; nested: boolean }[] = []

  for (const root of roots) {
    ordered.push({ item: root, nested: false })
    for (const child of childrenByParent.get(root.id) ?? []) {
      ordered.push({ item: child, nested: true })
    }
  }

  return ordered
}

export default function SaleItemsCell({ items }: { items: SaleItemSummary[] }) {
  if (!items.length) return <span className="text-base-content/50">Sin items</span>

  const ordered = orderItems(items)
  const visible = ordered.slice(0, 1)
  const hidden = ordered.slice(1)

  return (
    <div className="flex flex-col gap-1 p-2 border border-base-300 rounded-lg bg-base-200 w-auto">
      {visible.map(({ item, nested }) => (
        <ItemLine key={item.id} item={item} nested={nested} />
      ))}
      {hidden.length ? (
        <div className="dropdown dropdown-hover">
          <button type="button" tabIndex={0} className="btn btn-ghost btn-xs w-fit">
            +{hidden.length} mas
          </button>
          <div tabIndex={0} className="dropdown-content z-20 w-72 rounded-lg border border-base-300 bg-base-100 p-2 shadow-lg">
            {hidden.map(({ item, nested }) => (
              <ItemLine key={item.id} item={item} nested={nested} />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}
