import Link from 'next/link'
import DashboardLayout from '@/components/DashboardLayout'
import Breadcrumbs from '@/components/Breadcrumbs'
import SearchBar from '@/components/SearchBar'
import prisma from '@/lib/prisma'
import { requireRolePage } from '@/lib/auth/auth'

/**
 * Listado de perfiles de costo (CostProfile).
 * Esta pantalla utiliza el layout general del dashboard y un buscador simple.
 */
export default async function CostProfilesPage() {
  await requireRolePage(['ADMIN'])

  const profiles = await prisma.costProfile.findMany({ orderBy: { name: 'asc' } })
  return (
    <DashboardLayout >
      {/* Breadcrumbs para indicar la ruta actual */}
      <Breadcrumbs items={[{ label: 'Inicio', href: '/' }, { label: 'Perfiles de Costo' }]} />
      <div className="flex flex-col gap-4">
        {/* Título y acción */}
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold">Perfiles de Costo</h2>
          <Link href="/dashboard/cost-profiles/new" className="btn btn-primary">
            Nuevo Perfil
          </Link>
        </div>
        {/* Buscador: actualmente no filtra los datos en el servidor. No se pasa callback para evitar pasar
            funciones de servidor a componentes de cliente */}
        <SearchBar />
        <div className="overflow-x-auto rounded-box border border-base-content/5 bg-base-100">
          <table className="table table-zebra w-full">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Total (USD)</th>
                <th>Funda</th>
                <th>Templado</th>
                <th>Cable</th>
                <th>Tarjeta Garantía</th>
                <th>Sticker</th>
                <th>Envío</th>
                <th>Cajita</th>
                <th>Bolsita</th>
                <th>Comisión</th>
              </tr>
            </thead>
            <tbody>
              {profiles.map((p) => (
                <tr key={p.id}>
                  <td>{p.name}</td>
                  <td>{p.total ? Number(p.total).toFixed(2) : '-'}</td>
                  <td>{p.funda?.toFixed(2) ?? '-'}</td>
                  <td>{p.templado?.toFixed(2) ?? '-'}</td>
                  <td>{p.cable?.toFixed(2) ?? '-'}</td>
                  <td>{p.tarjetaGarantia?.toFixed(2) ?? '-'}</td>
                  <td>{p.sticker?.toFixed(2) ?? '-'}</td>
                  <td>{p.envio?.toFixed(2) ?? '-'}</td>
                  <td>{p.cajita?.toFixed(2) ?? '-'}</td>
                  <td>{p.bolsita?.toFixed(2) ?? '-'}</td>
                  <td>{p.comision?.toFixed(2) ?? '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {/* Paginación: se puede implementar en el servidor en un futuro. Actualmente es estática */}
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