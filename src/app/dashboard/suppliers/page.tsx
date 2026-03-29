import Link from 'next/link'
import DashboardLayout from '@/components/DashboardLayout'
import Breadcrumbs from '@/components/Breadcrumbs'
import SearchBar from '@/components/SearchBar'
import prisma from '@/lib/prisma'
import { requireRolePageWithFallback } from '@/lib/auth/auth'

/**
 * Listado de proveedores.
 * Se integra con el layout del dashboard y añade un buscador.
 */
export default async function SuppliersPage() {
  await requireRolePageWithFallback(['ADMIN', 'STOCK'], '/dashboard/suppliers')

  const suppliers = await prisma.supplier.findMany({ orderBy: { name: 'asc' } })
  return (
    <DashboardLayout >
      {/* Breadcrumbs de navegación */}
      <Breadcrumbs items={[{ label: 'Inicio', href: '/' }, { label: 'Proveedores' }]} />
      <div className="flex flex-col gap-4">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold">Proveedores</h2>
          <Link href="/suppliers/new" className="btn btn-primary">
            Nuevo Proveedor
          </Link>
        </div>
        {/* La barra de búsqueda no recibe callback en el servidor */}
        <SearchBar />
        <div className="overflow-x-auto rounded-box border border-base-content/5 bg-base-100">
          <table className="table table-zebra w-full">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Contacto</th>
                <th>Teléfono</th>
                <th>Email</th>
              </tr>
            </thead>
            <tbody>
              {suppliers.map((s) => (
                <tr key={s.id}>
                  <td>{s.name}</td>
                  <td>{s.contactName ?? '-'}</td>
                  <td>{s.phone ?? '-'}</td>
                  <td>{s.email ?? '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {/* Paginación estática */}
          <div className="join mt-4">
            <button className="join-item btn">«</button>
            <button className="join-item btn btn-active">1</button>
            <button className="join-item btn">2</button>
            <button className="join-item btn">»</button>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}