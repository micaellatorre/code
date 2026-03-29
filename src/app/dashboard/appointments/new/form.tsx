'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import Breadcrumbs from '@/components/Breadcrumbs';
import type { Buyer } from '../../../../../prisma/generated/client';
import BuyerSection from '@/components/sales/BuyerSection';
import AppointmentInterestSection, { AppointmentInterestDraft } from '@/components/appointments/AppointmentInterestSection';
import { fromArgDateTimeInputValue, toArgDateTimeInputValue } from '@/lib/timezone';

export default function NewAppointmentForm() {
  const router = useRouter();
  
  const [selectedBuyer, setSelectedBuyer] = useState<Buyer | null>(null);
  const [scheduledAt, setScheduledAt] = useState(new Date());
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<AppointmentInterestDraft[]>([]);
  
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setError(null);

    if (!selectedBuyer) {
        setError('Debe seleccionar un cliente.');
        setIsSubmitting(false);
        return;
    }

    const payload = {
      buyerId: selectedBuyer.id,
      scheduledAt: scheduledAt.toISOString(),
      durationMinutes,
      notes,
      interests: items.map(it => ({
        productId: it.productId,
        notes: it.notes,
        priority: it.priority,
      })),
    };

    try {
      const res = await fetch('/api/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        router.push('/dashboard/appointments');
      } else {
        const errorData = await res.json();
        setError(errorData.error || 'Ocurrió un error al crear la cita.');
      }
    } catch (e: any) {
      setError('No se pudo conectar con el servidor.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <DashboardLayout >
      <Breadcrumbs
        items={[
          { label: 'Inicio', href: '/' },
          { label: 'Citas', href: '/dashboard/appointments' },
          { label: 'Nueva Cita' },
        ]}
      />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 p-4">
        
        <div className="lg:col-span-2 flex flex-col gap-6">
            <BuyerSection selectedBuyer={selectedBuyer} setSelectedBuyer={setSelectedBuyer} />
            
            <div className="card bg-base-100 shadow-md p-4">
                <h2 className="font-bold text-lg">Detalles de la Cita</h2>
                <div className="form-control mt-4">
                    <label className="label"><span className="label-text">Fecha y Hora</span></label>
                    <input 
                        type="datetime-local"
                        value={toArgDateTimeInputValue(scheduledAt)}
                        onChange={e => setScheduledAt(fromArgDateTimeInputValue(e.target.value))}
                        className="input input-bordered"
                    />
                </div>
                <div className="form-control mt-4">
                    <label className="label"><span className="label-text">Duración (minutos)</span></label>
                    <input 
                        type="number"
                        value={durationMinutes}
                        onChange={e => setDurationMinutes(parseInt(e.target.value))}
                        className="input input-bordered"
                    />
                </div>
                <div className="form-control mt-4">
                    <label className="label"><span className="label-text">Notas</span></label>
                    <textarea
                        value={notes}
                        onChange={e => setNotes(e.target.value)}
                        className="textarea textarea-bordered"
                        rows={4}
                    ></textarea>
                </div>
            </div>
            
            <AppointmentInterestSection items={items} setItems={setItems} />
        </div>

        <div className="card bg-base-100 shadow-md max-h-fit">
            <div className="card-body">
                {error && <div className="alert alert-error">{error}</div>}
                <button
                    onClick={handleSubmit}
                    className="btn btn-primary w-full"
                    disabled={isSubmitting}
                >
                    {isSubmitting ? 'Creando...' : 'Crear Cita'}
                </button>
            </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
