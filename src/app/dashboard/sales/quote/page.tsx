import type { Metadata } from "next"
import Breadcrumbs from "@/components/Breadcrumbs"
import DashboardLayout from "@/components/DashboardLayout"
import SalesQuoteCalculator from "@/components/sales/SalesQuoteCalculator"
import { requireRolePage } from "@/lib/auth/auth"

export const metadata: Metadata = {
  title: "Cotizador",
  description: "Simulador de venta y medios de pago",
}

export const dynamic = "force-dynamic"

export default async function SalesQuotePage() {
  await requireRolePage(["ADMIN", "VENDEDOR"])

  return (
    <DashboardLayout>
      <Breadcrumbs items={[
        { label: "Inicio", href: "/" },
        { label: "Ventas", href: "/dashboard/sales" },
        { label: "Cotizador" },
      ]} />
      <SalesQuoteCalculator />
    </DashboardLayout>
  )
}
