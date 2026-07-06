"use client"

import DashboardLayout from "@/components/DashboardLayout"
import Breadcrumbs from "@/components/Breadcrumbs"
import SupplierForm from "@/components/suppliers/SupplierForm"

export default function NewSupplierForm() {
  return (
    <DashboardLayout>
      <Breadcrumbs
        items={[
          { label: "Inicio", href: "/" },
          { label: "Proveedores", href: "/dashboard/suppliers" },
          { label: "Nuevo proveedor" },
        ]}
      />
      <div className="mx-auto max-w-4xl space-y-5">
        <div>
          <h1 className="text-2xl font-bold">Nuevo proveedor</h1>
          <p className="text-sm text-base-content/60">Carga datos comerciales, ubicacion y cobertura por sucursal.</p>
        </div>
        <SupplierForm mode="create" />
      </div>
    </DashboardLayout>
  )
}
