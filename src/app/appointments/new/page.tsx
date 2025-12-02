
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import Breadcrumbs from '@/components/Breadcrumbs';
import { Buyer, Product, AppointmentStatus, AppointmentOutcome, AppointmentNoSaleReason } from '@prisma/client';
import BuyerSection from '@/components/sales/BuyerSection';
import AppointmentInterestSection, { AppointmentInterestDraft } from '@/components/appointments/AppointmentInterestSection';
import { fromArgDateTimeInputValue, toArgDateTimeInputValue } from '@/lib/timezone';

// --- MAIN PAGE COMPONENT ---
export default function NewAppointmentPage() {
  const router = useRouter();
  
  // Main state for the entire appointment form
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
        router.push('/appointments');
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
    <DashboardLayout activeTab="appointments">
      <Breadcrumbs
        items={[
          { label: 'Inicio', href: '/' },
          { label: 'Citas', href: '/appointments' },
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
                    <label className="label"><span className="label-text">Notas Internas</span></label>
                    <textarea
                        value={notes}
                        onChange={e => setNotes(e.target.value)}
                        className="textarea textarea-bordered"
                        placeholder="Notas sobre la cita, preparativos, etc."
                    />
                </div>
            </div>

            <AppointmentInterestSection items={items} setItems={setItems} />
        </div>

        <div className="lg:col-span-1">
            <div className="sticky top-4 flex flex-col gap-6">
                <div className="card bg-base-100 shadow-md">
                    <div className="card-body">
                        <h2 className="card-title">Confirmar Cita</h2>
                        <p>Revisá que los datos de la cita y los productos de interés sean correctos antes de guardar.</p>
                        
                        {error && <div className="alert alert-error text-sm">{error}</div>}

                        <div className="card-actions justify-end mt-4">
                            <button 
                                className="btn btn-primary"
                                onClick={handleSubmit}
                                disabled={isSubmitting || !selectedBuyer}
                            >
                                {isSubmitting && <span className="loading loading-spinner"></span>}
                                Guardar Cita
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
