
'use client';

import type { SaleItemDraft } from '@/app/dashboard/sales/new/form';
import type { SaleItemKind } from '@prisma/client';
import { useState } from 'react';
import ProductSelectionModal from './ProductSelectionModal';

interface SaleItemsSectionProps {
    items: SaleItemDraft[];
    setItems: (items: SaleItemDraft[]) => void;
    disabled?: boolean;
}

function getStateBadgeClass(state: string) {
    if (state === 'EN_STOCK' || state === 'DISPONIBLE') return 'badge-success';
    if (state === 'EN_CAMINO') return 'badge-info';
    if (state === 'RESERVADO') return 'badge-warning';
    if (state === 'VENDIDO' || state === 'FUERA_DE_STOCK') return 'badge-error';
    return 'badge-ghost';
}

export default function SaleItemsSection({ items, setItems, disabled = false }: SaleItemsSectionProps) {
    const [isModalOpen, setIsModalOpen] = useState(false);

    const handleAddItems = (newItems: SaleItemDraft[]) => {
        if (disabled) return;

        const updatedItems = [...items];
        newItems.forEach(newItem => {
            const existingIndex = updatedItems.findIndex(i => i.productId === newItem.productId);
            if (existingIndex > -1) {
                // If item exists, just update units
                const existingItem = updatedItems[existingIndex];
                const newUnits = existingItem.units + newItem.units;
                const stock = existingItem.product.stockAvailable ?? existingItem.product.stock;
                updatedItems[existingIndex] = { ...existingItem, units: Math.min(newUnits, stock) };
            } else {
                // Otherwise, add the new item
                updatedItems.push(newItem);
            }
        });

        setItems(updatedItems);
        setIsModalOpen(false);
    };

    const handleRemoveItem = (itemId: string) => {
        if (disabled) return;
        setItems(items.filter(i => i._id !== itemId));
    }

    const handleUpdateItem = (itemId: string, updatedFields: Partial<SaleItemDraft>) => {
        if (disabled) return;
        setItems(items.map(i => i._id === itemId ? { ...i, ...updatedFields } : i));
    }

    return (
        <div className="card bg-base-100 border border-base-content/50 p-4">
            <h2 className="font-bold text-lg">3. Items de Venta</h2>

            {items.length === 0 ? (
                <div className="text-center p-8 border border-base-content/50 border-dashed border-base-300 rounded-box mt-4">
                    <p className="text-base-content/70">Aún no agregaste productos.</p>
                    <button onClick={() => setIsModalOpen(true)} className="btn btn-primary btn-sm mt-4" disabled={disabled}>Agregar Ítem</button>
                </div>
            ) : (
                <div className="mt-4">
                    <div className="overflow-x-auto">
                        <table className="table w-full">
                            <thead>
                                <tr>
                                    <th>IMEI</th>
                                    <th>Producto</th>
                                    <th>% Bateria</th>
                                    <th>Estado</th>
                                    <th>Cantidad</th>
                                    <th>Precio Unit.</th>
                                    <th>Total</th>
                                    <th></th>
                                </tr>
                            </thead>
                            <tbody>
                                {items.map(item => (
                                    <tr key={item._id}>
                                        <td>{item.product.imei ? item.product.imei.slice(-4) : '-'}</td>
                                        <td>{item.product.modelName}</td>
                                        <td>{item.product.batteryPct ? item.product.batteryPct : '-'}</td>
                                        <td>
                                            <span className={`badge badge-sm ${getStateBadgeClass(String(item.product.state))}`}>
                                                {String(item.product.state).replace(/_/g, ' ')}
                                            </span>
                                        </td>
                                        <td>
                                            <input
                                                type="number"
                                                value={item.units}
                                                onChange={(e) => handleUpdateItem(item._id, { units: parseInt(e.target.value) || 1 })}
                                                className="input input-bordered input-sm w-20"
                                                min={1}
                                                max={item.product.stockAvailable ?? item.product.stock}
                                                disabled={disabled}
                                            />
                                        </td>
                                        <td>
                                            <div className="relative items-center baseline">
                                                <input
                                                    type="text"
                                                    value={item.unitPrice}
                                                    onChange={(e) => handleUpdateItem(item._id, { unitPrice: e.target.value })}
                                                    className="input input-bordered input-sm w-24 pl-6 text-right"
                                                    disabled={disabled}
                                                />
                                                <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-xs opacity-50">$</span>
                                            </div>
                                        </td>
                                        <td>
                                            <div className="flex flex-row justify-between items-center gap-2 h-full">
                                                <span className="text-xs opacity-50">$</span>
                                                <span className="text-right">
                                                    {(parseFloat(item.unitPrice) * item.units).toFixed(2)}
                                                </span>
                                            </div>
                                        </td>
                                        <td>
                                            <button onClick={() => handleRemoveItem(item._id)} className="btn btn-ghost btn-xs" disabled={disabled}>Quitar</button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <button onClick={() => setIsModalOpen(true)} className="btn btn-outline btn-sm mt-4 w-full" disabled={disabled}>+ Agregar más ítems</button>
                </div>
            )}

            {isModalOpen && !disabled && (
                <ProductSelectionModal
                    existingItems={items}
                    onClose={() => setIsModalOpen(false)}
                    onAddItems={handleAddItems}
                />
            )}
        </div>
    );
}
