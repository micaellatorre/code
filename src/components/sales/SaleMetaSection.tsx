
'use client';

import type { SaleMeta } from '@/app/dashboard/sales/new/form';
import { toArgDateTimeInputValue, fromArgDateTimeInputValue } from '@/lib/timezone';

interface SaleMetaSectionProps {
    meta: SaleMeta;
    setMeta: (meta: SaleMeta) => void;
}

const ORIGIN_OPTIONS = [
    'Instagram',
    'Facebook',
    'TikTok',
    'Conocido',
    'Whatsapp',
    'Mercado Libre',
    'Otro',
];

export default function SaleMetaSection({ meta, setMeta }: SaleMetaSectionProps) {
    
    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setMeta({ ...meta, [name]: value });
    };

    const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setMeta({ ...meta, date: fromArgDateTimeInputValue(e.target.value) });
    }

    return (
        <div className="card bg-base-100 shadow-md p-4">
            <h2 className="font-bold text-lg">2. Datos de la Venta</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                <div className="form-control">
                    <label className="label"><span className="label-text">Fecha de Venta</span></label>
                    <input 
                        type="datetime-local"
                        name="date"
                        value={toArgDateTimeInputValue(meta.date)}
                        onChange={handleDateChange}
                        className="input input-bordered"
                    />
                </div>
                <div className="form-control">
                    <label className="label"><span className="label-text">Origen</span></label>
                    <select 
                        name="origin"
                        value={meta.origin}
                        onChange={handleChange}
                        className="select select-bordered"
                    >
                        {ORIGIN_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                    </select>
                </div>
                {meta.origin === 'Otro' && (
                    <div className="form-control md:col-span-2">
                        <label className="label"><span className="label-text">Especificar Origen</span></label>
                        <input 
                            type="text"
                            name="customOrigin"
                            value={meta.customOrigin || ''}
                            onChange={handleChange}
                            className="input input-bordered"
                            placeholder="Escriba el origen..."
                        />
                    </div>
                )}
                <div className="form-control md:col-span-2">
                    <label className="label"><span className="label-text">Notas (Opcional)</span></label>
                    <textarea
                        name="notes"
                        value={meta.notes || ''}
                        onChange={handleChange}
                        className="textarea textarea-bordered"
                        placeholder="Notas internas sobre la venta..."
                    />
                </div>
            </div>
        </div>
    );
}
