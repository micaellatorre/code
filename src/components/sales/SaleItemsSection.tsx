
'use client';

import type { SaleItemDraft } from '@/app/dashboard/sales/new/form';
import type { SaleItemKind } from '@prisma/client';
import { useState } from 'react';
import ProductSelectionModal from './ProductSelectionModal';

interface SaleItemsSectionProps {
    items: SaleItemDraft[];
    setItems: (items: SaleItemDraft[]) => void;
}

export default function SaleItemsSection({ items, setItems }: SaleItemsSectionProps) {
    const [isModalOpen, setIsModalOpen] = useState(false);

    const handleAddItems = (newItems: SaleItemDraft[]) => {
        const updatedItems = [...items];
        newItems.forEach(newItem => {
            const existingIndex = updatedItems.findIndex(i => i.productId === newItem.productId);
            if (existingIndex > -1) {
                // If item exists, just update units
                const existingItem = updatedItems[existingIndex];
                const newUnits = existingItem.units + newItem.units;
                const stock = existingItem.product.stock;
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
        setItems(items.filter(i => i._id !== itemId));
    }

    const handleUpdateItem = (itemId: string, updatedFields: Partial<SaleItemDraft>) => {
        setItems(items.map(i => i._id === itemId ? { ...i, ...updatedFields } : i));
    }

    return (
        <div className="card bg-base-100 border border-base-content/50 p-4">
            <h2 className="font-bold text-lg">3. Items de Venta</h2>
            
            {items.length === 0 ? (
                <div className="text-center p-8 border border-base-content/50 border-dashed border-base-300 rounded-box mt-4">
                    <p className="text-base-content/70">Aún no agregaste productos.</p>
                    <button onClick={() => setIsModalOpen(true)} className="btn btn-primary btn-sm mt-4">Agregar Ítem</button>
                </div>
            ) : (
                <div className="mt-4">
                    <div className="overflow-x-auto">
                        <table className="table w-full">
                            <thead>
                                <tr>
                                    <th></th>
                                    <th>IMEI</th>
                                    <th>Producto</th>
                                    <th>Cantidad</th>
                                    <th>Precio Unit.</th>
                                    <th>Tipo</th>
                                    <th>Total</th>
                                    <th></th>
                                </tr>
                            </thead>
                            <tbody>
                                {items.map(item => (
                                    <tr key={item._id}>
                                        <td>{item.product.imei ? item.product.imei.slice(-4) : 'N/A'}</td>
                                        <td>{item.product.modelName}</td>
                                        <td>
                                            <input 
                                                type="number"
                                                value={item.units}
                                                onChange={(e) => handleUpdateItem(item._id, { units: parseInt(e.target.value) || 1 })}
                                                className="input input-bordered input-sm w-20"
                                                min={1}
                                                max={item.product.stock} // Simple stock validation
                                            />
                                        </td>
                                        <td>
                                            <input 
                                                type="text" 
                                                value={item.unitPrice}
                                                onChange={(e) => handleUpdateItem(item._id, { unitPrice: e.target.value })}
                                                className="input input-bordered input-sm w-24"
                                            />
                                        </td>
                                        <td>
                                            {item.product.type === 'ACCESSORY' ? (
                                                <select 
                                                    value={item.kind}
                                                    onChange={(e) => handleUpdateItem(item._id, { kind: e.target.value as SaleItemKind })}
                                                    className="select select-bordered select-sm"
                                                >
                                                    <option value="NORMAL">Normal</option>
                                                    <option value="ZERO_COST">Sin Cargo</option>
                                                    <option value="IN_TOTAL">Costo en Total</option>
                                                </select>
                                            ) : (
                                                <span className="badge badge-ghost">{item.kind}</span>
                                            )}
                                        </td>
                                        <td>{(parseFloat(item.unitPrice) * item.units).toFixed(2)}</td>
                                        <td>
                                            <button onClick={() => handleRemoveItem(item._id)} className="btn btn-ghost btn-xs">Quitar</button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <button onClick={() => setIsModalOpen(true)} className="btn btn-outline btn-sm mt-4 w-full">+ Agregar más ítems</button>
                </div>
            )}

            {isModalOpen && (
                <ProductSelectionModal 
                    existingItems={items}
                    onClose={() => setIsModalOpen(false)} 
                    onAddItems={handleAddItems} 
                />
            )}
        </div>
    );
}
