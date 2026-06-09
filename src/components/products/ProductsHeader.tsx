import ArrowsRightLeftIcon from "@heroicons/react/24/outline/ArrowsRightLeftIcon"
import Link from "next/link"

export default function ProductsHeader({ canCreate }: { canCreate: boolean }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold">Productos</h1>
        <p className="mt-1 text-sm text-base-content/60">Stock operativo, disponibilidad y seguimiento de equipos.</p>
      </div>

      <div className="flex items-center gap-2">
        <Link href="/dashboard/trade-in" className="btn btn-outline btn-sm">
          Plan Canje
          <ArrowsRightLeftIcon className="size-5" />
        </Link>
        {canCreate ? (
          <Link href="/dashboard/products/new" className="btn btn-primary btn-sm">
            Nuevo Producto
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="size-5">
              <path d="M10.75 4.75a.75.75 0 0 0-1.5 0v4.5h-4.5a.75.75 0 0 0 0 1.5h4.5v4.5a.75.75 0 0 0 1.5 0v-4.5h4.5a.75.75 0 0 0 0-1.5h-4.5v-4.5Z" />
            </svg>
          </Link>
        ) : null}
      </div>
    </div>
  )
}
