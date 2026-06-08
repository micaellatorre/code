
'use client';

import type { PaymentDraft } from '@/components/sales/types';
import type { PaymentMethod, Currency } from '@prisma/client';
import { useMemo } from 'react';

interface PaymentsSectionProps {
    payments: PaymentDraft[];
    setPayments: (payments: PaymentDraft[]) => void;
    total: string; // The total from the TotalsBar to compare against
    disabled?: boolean;
}

const PAYMENT_METHODS: PaymentMethod[] = [
  'EFECTIVO_PESOS',
  'EFECTIVO_USD',
  'TRANSFERENCIA_ARS',
  'TRANSFERENCIA_USD',
  'TARJETA',
  'USDT',
  'PLAN_CANJE'
];
const CURRENCIES: Currency[] = ['ARS', 'USD', 'USDT'];

export default function PaymentsSection({ payments, setPayments, total, disabled = false }: PaymentsSectionProps) {

    const totalPaid = useMemo(() => payments.reduce((acc, p) => acc + parseFloat(p.amount || '0'), 0), [payments]);

    const remaining = useMemo(() => parseFloat(total) - totalPaid, [total, totalPaid]);

    const addPayment = () => {
        if (disabled) return;

        const newPayment: PaymentDraft = {
            _id: `payment-${Date.now()}`,
            amount: remaining > 0 ? remaining.toFixed(2) : '0.00',
            method: 'EFECTIVO_USD',
            currency: 'USD',
        };
        setPayments([...payments, newPayment]);
    };

    const updatePayment = (id: string, updatedFields: Partial<PaymentDraft>) => {
        if (disabled) return;
        setPayments(payments.map(p => p._id === id ? { ...p, ...updatedFields } : p));
    };

    const removePayment = (id: string) => {
        if (disabled) return;
        setPayments(payments.filter(p => p._id !== id));
    };

    return (
        <div className="card bg-base-100 border border-base-content/50 p-4">
            <div className="flex justify-between items-center">
                <h2 className="font-bold text-lg">Medio(s) de Pago</h2>
                <div className="text-right">
                    <div className={`font-mono text-lg ${remaining < 0 ? 'text-error' : ''}`}>{remaining.toFixed(2)}</div>
                    <div className="text-xs text-base-content/70">Restante</div>
                </div>
            </div>

            <div className="flex flex-col gap-2 mt-4">
                {payments.map(p => (
                    <div key={p._id} className="grid grid-cols-1 md:grid-cols-4 gap-2 p-2 bg-base-200 rounded-box">
                        <div className="form-control">
                            <label className="label-text pb-1">Importe</label>
                            <input 
                                type="text" 
                                placeholder="0.00"
                                value={p.amount}
                                onChange={e => updatePayment(p._id, { amount: e.target.value })}
                                className="input input-bordered input-sm"
                                disabled={disabled}
                            />
                        </div>
                        <div className="form-control">
                            <label className="label-text pb-1">Método</label>
                            <select 
                                value={p.method}
                                onChange={e => updatePayment(p._id, { method: e.target.value as PaymentMethod })}
                                className="select select-bordered select-sm"
                                disabled={disabled}
                            >
                                {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m.replace(/_/g, ' ')}</option>)}
                            </select>
                        </div>
                        <div className="form-control">
                            <label className="label-text pb-1">Moneda</label>
                             <select 
                                value={p.currency}
                                onChange={e => updatePayment(p._id, { currency: e.target.value as Currency })}
                                className="select select-bordered select-sm"
                                disabled={disabled}
                            >
                                {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>
                        {(p.method === 'EFECTIVO_PESOS' || p.method === 'TRANSFERENCIA_ARS' || p.currency === 'ARS') && (
                            <div className="form-control">
                                <label className="label-text pb-1">Cotizacion</label>
                                <input
                                    type="text"
                                    placeholder="Tipo de cambio"
                                    value={p.exchangeRate || ''}
                                    onChange={e => updatePayment(p._id, { exchangeRate: e.target.value })}
                                    className="input input-bordered input-sm"
                                    disabled={disabled}
                                />
                            </div>
                        )}
                        <div className="flex items-end gap-1">
                            {/* Optional: Add note field later */}
                            <button
                                onClick={() => removePayment(p._id)}
                                className="btn btn-ghost btn-sm text-error"
                                disabled={disabled}
                            >
                                Eliminar
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            <button onClick={addPayment} className="btn btn-outline btn-sm mt-4 w-full" disabled={disabled}>
                + Agregar Pago
            </button>
        </div>
    );
}
