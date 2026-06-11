"use client"

import Link from "next/link"
import { PlusIcon } from "@heroicons/react/24/outline"

type BuyersTableHeaderProps = {
  canCreate: boolean
}

export default function BuyersTableHeader({ canCreate }: BuyersTableHeaderProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold">Clientes</h1>
        <p className="mt-1 text-sm text-base-content/60">Listado operativo de clientes minoristas y mayoristas.</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {canCreate ? (
          <Link href="/dashboard/buyers/new" className="btn btn-primary btn-sm">
            Nuevo Cliente
            <PlusIcon className="size-4" />
          </Link>
        ) : null}
      </div>
    </div>
  )
}
