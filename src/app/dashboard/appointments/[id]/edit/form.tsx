'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import Breadcrumbs from '@/components/Breadcrumbs';
import type { Buyer, Product, AppointmentStatus, AppointmentOutcome, AppointmentNoSaleReason } from '../../../../../../prisma/generated/client';
import BuyerSection from '@/components/sales/BuyerSection';
import AppointmentInterestSection, { AppointmentInterestDraft } from '@/components/appointments/AppointmentInterestSection';
import { fromArgDateTimeInputValue, toArgDateTimeInputValue } from '@/lib/timezone';

type AppointmentFull = {
    id: string;
    scheduledAt: string;
    durationMinutes: number | null;
    status: AppointmentStatus;
    outcome: AppointmentOutcome;
    noSaleReason: AppointmentNoSaleReason | null;
    noSaleReasonOther: string | null;
    resultNotes: string | null;
    buyer: Buyer;
    interests: ({ product: Product } & { productId: string; notes: string | null; priority: number | null; })[];
};

interface EditAppointmentFormProps {
  id: string
}

export default function EditAppointmentForm({ id }: EditAppointmentFormProps) {
  const router = useRouter();
  
  const [appointment, setAppointment] = useState<AppointmentFull | null>(null);
  const [selectedBuyer, setSelectedBuyer] = useState<Buyer | null>(null);
  const [scheduledAt, setScheduledAt] = useState(new Date());
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [status, setStatus] = useState<AppointmentStatus>('PROGRAMADA');
  const [outcome, setOutcome] = useState<AppointmentOutcome>('PENDIENTE');
  const [noSaleReason, setNoSaleReason] = useState<AppointmentNoSaleReason | null>(null);
  const [noSaleReasonOther, setNoSaleReasonOther] = useState('');
  const [resultNotes, setResultNotes] = useState('');
  const [items, setItems] = useState<AppointmentInterestDraft[]>([]);
  
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    const fetchAppointment = async () => {
        setIsLoading(true);
        try {
            const res = await fetch(`/api/appointments/${id}`);
            if (res.ok) {
                const data = await res.json();
                setAppointment(data);
                setSelectedBuyer(data.buyer);
                setScheduledAt(new Date(data.scheduledAt));
                setDurationMinutes(data.durationMinutes || 60);
                setStatus(data.status);
                setOutcome(data.outcome);
                setNoSaleReason(data.noSaleReason);
                setNoSaleReasonOther(data.noSaleReasonOther || '');
                setResultNotes(data.resultNotes || '');
                setItems(data.interests.map((i: any) => ({ ...i, _id: i.id })));
            } else {
                setError('No se pudo cargar la cita.');
            }
        } catch (e) {
            setError('Error de conexión.');
        } finally {
            setIsLoading(false);
        }
    };
    fetchAppointment();
  }, [id]);

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setError(null);

    const payload = {
      scheduledAt: scheduledAt.toISOString(),
      durationMinutes,
      status,
      outcome,
      noSaleReason: outcome === 'NO_SE_CONCRETO' ? noSaleReason : null,
      noSaleReasonOther: outcome === 'NO_SE_CONCRETO' && noSaleReason === 'OTRO' ? noSaleReasonOther : null,
      resultNotes,
      interests: items.map(it => ({
        productId: it.productId,
        notes: it.notes,
        priority: it.priority,
      })),
    };

    try {
      const res = await fetch(`/api/appointments/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        router.push('/dashboard/appointments');
      } else {
        const errorData = await res.json();
        setError(errorData.error || 'Ocurrió un error al actualizar la cita.');
      }
    } catch (e: any) {
      setError('No se pudo conectar con el servidor.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return <DashboardLayout ><div className="flex justify-center items-center h-full"><span className="loading loading-lg"></span></div></DashboardLayout>;
  }

  if (error && !appointment) {
    return <DashboardLayout ><div className="alert alert-error">{error}</div></DashboardLayout>;
  }

  return (
    <DashboardLayout >
      <Breadcrumbs
        items={[
          { label: 'Inicio', href: '/' },
          { label: 'Citas', href: '/dashboard/appointments' },
          { label: 'Editar Cita' },
        ]}
      />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 p-4">
        <div className="lg:col-span-2 flex flex-col gap-4">
            {selectedBuyer && <BuyerSection selectedBuyer={selectedBuyer} setSelectedBuyer={() => {}} />}
            
            <div className="card bg-base-100 border border-base-content/50 p-4">
                <h2 className="font-bold text-lg">Detalles de la Cita</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                    <div className="form-control">
                        <label className="label"><span className="label-text">Fecha y Hora</span></label>
                        <input type="datetime-local" value={toArgDateTimeInputValue(scheduledAt)} onChange={e => setScheduledAt(fromArgDateTimeInputValue(e.target.value))} className="input input-bordered"/>
                    </div>
                    <div className="form-control">
                        <label className="label"><span className="label-text">Duración (minutos)</span></label>
                        <input type="number" value={durationMinutes} onChange={e => setDurationMinutes(parseInt(e.target.value))} className="input input-bordered"/>
                    </div>
                    <div className="form-control">
                        <label className="label"><span className="label-text">Estado</span></label>
                        <select value={status} onChange={e => setStatus(e.target.value as AppointmentStatus)} className="select select-bordered">
                            {['PROGRAMADA', 'CONCRETADA', 'CANCELADA', 'NO_SE_PRESENTO'].map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                    </div>
                    <div className="form-control">
                        <label className="label"><span className="label-text">Resultado</span></label>
                        <select value={outcome} onChange={e => setOutcome(e.target.value as AppointmentOutcome)} className="select select-bordered">
                            {['PENDIENTE', 'VENTA_CONCRETADA', 'NO_SE_CONCRETO'].map(o => <option key={o} value={o}>{o}</option>)}
                        </select>
                    </div>
                </div>
                {outcome === 'NO_SE_CONCRETO' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                        <div className="form-control">
                            <label className="label"><span className="label-text">Razón de no-venta</span></label>
                            <select value={noSaleReason || ''} onChange={e => setNoSaleReason(e.target.value as AppointmentNoSaleReason)} className="select select-bordered">
                                <option disabled value="">Seleccione un motivo</option>
                                {['MUY_CARO', 'MODELO_NO_DISPONIBLE', 'ENCONTRO_MEJOR_OFERTA', 'LO_ESTA_PENSANDO', 'NO_SE_PRESENTO', 'OTRO'].map(r => <option key={r} value={r}>{r}</option>)}
                            </select>
                        </div>
                        {noSaleReason === 'OTRO' && (
                            <div className="form-control">
                                <label className="label"><span className="label-text">Otro Motivo</span></label>
                                <input type="text" value={noSaleReasonOther} onChange={e => setNoSaleReasonOther(e.target.value)} className="input input-bordered" />
                            </div>
                        )}
                    </div>
                )}
                 <div className="form-control mt-4">
                    <label className="label"><span className="label-text">Notas de la Cita / Resultado</span></label>
                    <textarea value={resultNotes} onChange={e => setResultNotes(e.target.value)} className="textarea textarea-bordered" placeholder="Cómo fue la cita, feedback del cliente, etc."/>
                </div>
            </div>

            <AppointmentInterestSection items={items} setItems={setItems} />
        </div>

        <div className="lg:col-span-1">
            <div className="sticky top-4 flex flex-col gap-6">
                <div className="card bg-base-100 border border-base-content/50">
                    <div className="card-body">
                        <h2 className="card-title">Actualizar Cita</h2>
                        {error && <div className="alert alert-error text-sm">{error}</div>}
                        <div className="card-actions justify-end mt-4">
                            <button className="btn btn-primary" onClick={handleSubmit} disabled={isSubmitting}>
                                {isSubmitting && <span className="loading loading-spinner"></span>}
                                Guardar Cambios
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>

      </div>
    </DashboardLayout>
  );
}
