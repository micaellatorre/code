
'use client';

import type { SaleItemDraft, PaymentDraft } from '@/app/dashboard/sales/new/form';
import type { Role } from '@/lib/auth/roles';
import { useSession } from 'next-auth/react';
import { useMemo } from 'react';

interface TotalsBarProps {
    items: SaleItemDraft[];
    payments: PaymentDraft[];
}

export default function TotalsBar({ items, payments }: TotalsBarProps) {
    const { data: session } = useSession();
    const activeRole = (session?.user as { activeRole?: Role } | undefined)?.activeRole;
    const isAdmin = activeRole === 'ADMIN';

    const totals = useMemo(() => {
        // TODO: Use big.js for precision to avoid floating point issues.
        const subtotal = items
            .filter(it => it.kind === 'NORMAL')
            .reduce((acc, it) => acc + parseFloat(it.unitPrice || '0') * it.units, 0);

        const costOfInTotalItems = items
            .filter(it => it.kind === 'IN_TOTAL')
            .reduce((acc, it) => acc + (parseFloat(it.unitCost || '0') + parseFloat(it.extraCost || '0')) * it.units, 0);
        
        // This is a simplification. A more robust calculation might be needed depending on business rules for other extra costs.
        const extraCosts = costOfInTotalItems;

        const total = subtotal + extraCosts;

        const costTotal = items
            .reduce((acc, it) => acc + (parseFloat(it.unitCost || '0') + parseFloat(it.extraCost || '0')) * it.units, 0);

        const profit = total - costTotal;

        const totalPaid = payments.reduce((acc, p) => acc + parseFloat(p.amount || '0'), 0);
        
        const remaining = total - totalPaid;

        return {
            subtotal: subtotal.toFixed(2),
            extraCosts: extraCosts.toFixed(2),
            total: total.toFixed(2),
            costTotal: costTotal.toFixed(2),
            profit: profit.toFixed(2),
            remaining: remaining.toFixed(2),
            remainingRaw: remaining,
        };
    }, [items, payments]);

    return (
        <div className="card bg-base-100 border border-base-content/50">
            <div className="card-body">
                <h2 className="card-title">Resumen de la Venta</h2>
                <div className="space-y-2 mt-4 text-sm">
                    <div className="flex justify-between">
                        <span className="text-base-content/70">Subtotal</span>
                        <span className="font-mono">${totals.subtotal}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-base-content/70">Costos Extra</span>
                        <span className="font-mono">${totals.extraCosts}</span>
                    </div>
                    <div className="divider my-1"></div>
                    <div className="flex justify-between text-lg font-bold">
                        <span>Total</span>
                        <span className="font-mono">${totals.total}</span>
                    </div>
                    <div className="divider my-1"></div>
                    {isAdmin ? (
                        <>
                            <div className="flex justify-between">
                                <span className="text-base-content/70">Costo Total</span>
                                <span className="font-mono text-warning">-${totals.costTotal}</span>
                            </div>
                            <div className="flex justify-between font-semibold">
                                <span className="text-success">Ganancia</span>
                                <span className={`font-mono ${totals.profit.startsWith('-') ? 'text-error' : 'text-success'}`}>${totals.profit}</span>
                            </div>
                            <div className="divider my-1"></div>
                        </>
                    ) : null}
                     <div className={`flex justify-between p-2 rounded-lg ${totals.remainingRaw < 0 ? 'bg-error/20' : 'bg-base-200'}`}>
                        <span className="font-semibold">Restan por Pagar</span>
                        <span className={`font-mono font-bold ${totals.remainingRaw !== 0 ? 'text-warning' : 'text-success'}`}>${totals.remaining}</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
