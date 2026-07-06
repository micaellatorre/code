import Link from "next/link"
import DashboardLayout from "@/components/DashboardLayout"
import Breadcrumbs from "@/components/Breadcrumbs"
import PurchasesTable from "@/components/purchases/PurchasesTable"
import { requireRolePage } from "@/lib/auth/auth"
import { resolveSessionTenantId } from "@/lib/tenant"
import { listPurchases } from "@/lib/domain/purchases"

type PurchasesPageProps = {
  searchParams?: Promise<{ q?: string; type?: string }>
}

export default async function PurchasesPage({ searchParams }: PurchasesPageProps) {
  const session = await requireRolePage(["ADMIN", "STOCK", "SOCIO"])
  const tenantId = await resolveSessionTenantId(session.user.tenantId)
  if (!tenantId) throw new Error("Tenant no disponible")

  const params = await searchParams
  const selectedType = params?.type === "PHONE" || params?.type === "ACCESSORY" ? params.type : null
  const purchases = await listPurchases({ tenantId, q: params?.q, type: selectedType })

  const phoneCount = purchases.filter((purchase) => purchase.productTypes.includes("PHONE")).length
  const accessoryCount = purchases.filter((purchase) => purchase.productTypes.includes("ACCESSORY")).length

  return (
    <DashboardLayout>
      <Breadcrumbs items={[{ label: "Inicio", href: "/" }, { label: "Compras" }]} />
      <div className="space-y-5">
        <div className="flex flex-col justify-between gap-3 md:flex-row md:items-end">
          <div>
            <h1 className="text-2xl font-bold">Compras</h1>
            <p className="text-sm text-base-content/60">Historial de ingreso de mercaderia, pagos y seguimiento operativo.</p>
          </div>
          <Link href="/dashboard/purchases/new" className="btn btn-primary">Nueva compra</Link>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded border border-base-300 p-3"><div className="text-xs uppercase text-base-content/50">Total</div><div className="text-xl font-semibold">{purchases.length}</div></div>
          <div className="rounded border border-base-300 p-3"><div className="text-xs uppercase text-base-content/50">Equipos</div><div className="text-xl font-semibold">{phoneCount}</div></div>
          <div className="rounded border border-base-300 p-3"><div className="text-xs uppercase text-base-content/50">Accesorios</div><div className="text-xl font-semibold">{accessoryCount}</div></div>
        </div>

        <form className="grid gap-3 rounded border border-base-300 bg-base-100 p-3 md:grid-cols-[auto_1fr_auto]">
          <div className="join">
            <button name="type" value="" className={`btn join-item ${!selectedType ? "btn-primary" : "btn-outline"}`}>Todas</button>
            <button name="type" value="PHONE" className={`btn join-item ${selectedType === "PHONE" ? "btn-primary" : "btn-outline"}`}>Equipos</button>
            <button name="type" value="ACCESSORY" className={`btn join-item ${selectedType === "ACCESSORY" ? "btn-primary" : "btn-outline"}`}>Accesorios</button>
          </div>
          <input name="q" defaultValue={params?.q ?? ""} className="input input-bordered" placeholder="Buscar por proveedor, modelo o IMEI..." />
          <button type="submit" className="btn btn-outline">Buscar</button>
        </form>

        <PurchasesTable purchases={purchases} />
      </div>
    </DashboardLayout>
  )
}
