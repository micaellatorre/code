
'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { AppointmentStatus, AppointmentOutcome } from '@prisma/client';

type SerializedAppointment = {
    id: string;
    scheduledAt: string;
    durationMinutes: number | null;
    status: AppointmentStatus;
    outcome: AppointmentOutcome;
    noSaleReason: string | null;
    buyer: {
        name: string;
        phone: string | null;
        instagram: string | null;
    } | null;
    interests: string;
    resultNotes: string | null;
};

export default function FilterableAppointmentsTable({ initial }: { initial: SerializedAppointment[] }) {
    const [appointments, setAppointments] = useState<SerializedAppointment[]>(initial);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<AppointmentStatus | 'ALL'>('ALL');
    const [outcomeFilter, setOutcomeFilter] = useState<AppointmentOutcome | 'ALL'>('ALL');

    const filteredAppointments = useMemo(() => {
        return appointments.filter(a => {
            const query = searchQuery.toLowerCase();
            const matchesQuery = !query ||
                a.buyer?.name.toLowerCase().includes(query) ||
                a.buyer?.phone?.toLowerCase().includes(query) ||
                a.buyer?.instagram?.toLowerCase().includes(query) ||
                a.interests.toLowerCase().includes(query);

            const matchesStatus = statusFilter === 'ALL' || a.status === statusFilter;
            const matchesOutcome = outcomeFilter === 'ALL' || a.outcome === outcomeFilter;

            return matchesQuery && matchesStatus && matchesOutcome;
        });
    }, [appointments, searchQuery, statusFilter, outcomeFilter]);

    const formatDate = (iso: string) => new Date(iso).toLocaleString('es-AR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });

    return (
        <div className="card bg-base-100 shadow-md">
            <div className="card-body">
                <h2 className="card-title">Listado de Citas</h2>
                
                {/* Filters */}
                <div className="flex flex-wrap gap-4 my-4 p-2 bg-base-200 rounded-box">
                    <input
                        type="text"
                        placeholder="Buscar por cliente, contacto o interés..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="input input-bordered input-sm flex-grow"
                    />
                    <select 
                        className="select select-bordered select-sm"
                        value={statusFilter}
                        onChange={e => setStatusFilter(e.target.value as any)}
                    >
                        <option value="ALL">Todos los Estados</option>
                        {Object.values(AppointmentStatus).map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <select 
                        className="select select-bordered select-sm"
                        value={outcomeFilter}
                        onChange={e => setOutcomeFilter(e.target.value as any)}
                    >
                        <option value="ALL">Todos los Resultados</option>
                        {Object.values(AppointmentOutcome).map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                </div>

                {/* Table */}
                <div className="overflow-x-auto">
                    <table className="table table-zebra w-full">
                        <thead>
                            <tr>
                                <th>Fecha y Hora</th>
                                <th>Cliente</th>
                                <th>Contacto</th>
                                <th>Intereses</th>
                                <th>Estado</th>
                                <th>Resultado</th>
                                <th>Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredAppointments.map(a => (
                                <tr key={a.id}>
                                    <td>{formatDate(a.scheduledAt)}</td>
                                    <td>{a.buyer?.name || 'N/A'}</td>
                                    <td>
                                        {a.buyer?.phone && <div>📞 {a.buyer.phone}</div>}
                                        {a.buyer?.instagram && <div>📷 {a.buyer.instagram}</div>}
                                    </td>
                                    <td className="max-w-xs truncate">{a.interests}</td>
                                    <td><span className={`badge badge-outline badge-${a.status === 'COMPLETED' ? 'success' : 'warning'}`}>{a.status}</span></td>
                                    <td><span className={`badge badge-outline badge-${a.outcome === 'SALE_COMPLETED' ? 'success' : 'ghost'}`}>{a.outcome}</span></td>
                                    <td>
                                        <Link href={`/appointments/${a.id}/edit`} className="btn btn-xs btn-ghost">
                                            Editar
                                        </Link>
                                    </td>
                                </tr>
                            ))}
                            {filteredAppointments.length === 0 && (
                                <tr>
                                    <td colSpan={7} className="text-center">No se encontraron citas.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
