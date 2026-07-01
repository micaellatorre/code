"use client"

import Link from "next/link"
import { DevicePhoneMobileIcon, ShoppingBagIcon } from "@heroicons/react/24/outline"
import ImeiDisplay from "@/components/common/ImeiDisplay"
import type { AppointmentInterestSummary } from "./types"

function ProductTypeIcon({ type }: { type: string }) {
  return type.toUpperCase() === "PHONE" ? (
    <DevicePhoneMobileIcon className="size-4 shrink-0 mt-1" />
  ) : (
    <ShoppingBagIcon className="size-4 shrink-0 mt-1" />
  )
}

function ItemSummary({ interest }: { interest: AppointmentInterestSummary }) {
  const product = interest.product
  const details = [
    product.capacityGB ? `${product.capacityGB}GB` : null,
    product.color,
    product.batteryPct ? `${product.batteryPct}% bat.` : null,
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
    <Link
      href={`/dashboard/products/${interest.productId}/edit`}
      className="flex min-w-56 items-start gap-2 rounded-md p-2 hover:bg-base-200"
    >
      <ProductTypeIcon type={String(product.type ?? "")} />
      <span className="min-w-0">
        <span className="block truncate font-medium">{product.modelName}</span>
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
        <span className="mt-1 flex flex-wrap gap-1">
          {product.state ? <span className="badge badge-outline badge-sm">{product.state}</span> : null}
          {product.senado ? <span className="badge badge-warning badge-sm">Senado</span> : null}
        </span>
      </span>
    </Link>
  )
}

export default function AppointmentItemsCell({ interests }: { interests: AppointmentInterestSummary[] }) {
  if (!interests.length) return <span className="text-base-content/50">Sin items</span>

  const visible = interests.slice(0, 1)
  const hidden = interests.slice(1)

  return (
    <div className="flex flex-col gap-1 p-2 border border-base-300 rounded-lg bg-base-200">
      {visible.map((interest) => (
        <ItemSummary key={interest.id} interest={interest} />
      ))}
      {hidden.length > 0 ? (
        <div className="dropdown dropdown-hover">
          <button type="button" tabIndex={0} className="btn btn-ghost btn-xs w-fit">
            +{hidden.length} mas
          </button>
          <div tabIndex={0} className="dropdown-content z-20 w-72 rounded-lg border border-base-300 bg-base-100 p-2 shadow-lg">
            {hidden.map((interest) => (
              <ItemSummary key={interest.id} interest={interest} />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}
