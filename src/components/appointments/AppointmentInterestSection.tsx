'use client';

import type { Product } from '@prisma/client';
import { useState } from 'react';
import ProductSelectionModal from '../sales/ProductSelectionModal';

// This is a temporary type, it should be defined where it is used, e.g., in the appointment page.
export type AppointmentInterestDraft = {
  _id: string; // for react key
  productId: string;
  product: Product;
  notes?: string;
  priority?: number;
};

interface AppointmentInterestSectionProps {
    items: AppointmentInterestDraft[];
    setItems: (items: AppointmentInterestDraft[]) => void;
}

export default function AppointmentInterestSection({ items, setItems }: AppointmentInterestSectionProps) {
    const [isModalOpen, setIsModalOpen] = useState(false);

    const handleAddItems = (newItems: any[]) => { // The type from ProductSelectionModal is SaleItemDraft
        const updatedItems = [...items];
        newItems.forEach(newItem => {
            const existingIndex = updatedItems.findIndex(i => i.productId === newItem.productId);
            if (existingIndex === -1) {
                updatedItems.push({
                    _id: newItem._id,
                    productId: newItem.productId,
                    product: newItem.product,
                    notes: '',
                    priority: 1,
                });
            }
        });

        setItems(updatedItems);
        setIsModalOpen(false);
    };

    const handleRemoveItem = (itemId: string) => {
        setItems(items.filter(i => i._id !== itemId));
    }

    const handleUpdateItem = (itemId: string, updatedFields: Partial<AppointmentInterestDraft>) => {
        setItems(items.map(i => i._id === itemId ? { ...i, ...updatedFields } : i));
    }

    return (
        <div className="card bg-base-100 border border-base-content/50 p-4">
            <h2 className="font-bold text-lg">Productos de Interés</h2>
            
            {items.length === 0 ? (
                <div className="text-center p-8 border border-base-content/50 border-dashed border-base-300 rounded-box mt-4">
                    <p className="text-base-content/70">Aún no hay productos de interés.</p>
                    <button onClick={() => setIsModalOpen(true)} className="btn btn-primary btn-sm mt-4">Agregar Productos</button>
                </div>
            ) : (
                <div className="mt-4">
                    <div className="overflow-x-auto">
                        <table className="table w-full">
                            <thead>
                                <tr>
                                    <th>Producto</th>
                                    <th>Notas</th>
                                    <th>Prioridad</th>
                                    <th></th>
                                </tr>
                            </thead>
                            <tbody>
                                {items.map(item => (
                                    <tr key={item._id}>
                                        <td>{item.product.modelName}</td>
                                        <td>
                                            <input 
                                                type="text"
                                                value={item.notes || ''}
                                                onChange={(e) => handleUpdateItem(item._id, { notes: e.target.value })}
                                                className="input input-bordered input-sm w-full"
                                                placeholder="Ej: color azul, 256GB"
                                            />
                                        </td>
                                        <td>
                                            <input 
                                                type="number" 
                                                value={item.priority || 1}
                                                onChange={(e) => handleUpdateItem(item._id, { priority: parseInt(e.target.value) || 1 })}
                                                className="input input-bordered input-sm w-20"
                                                min={1}
                                            />
                                        </td>
                                        <td>
                                            <button onClick={() => handleRemoveItem(item._id)} className="btn btn-ghost btn-xs">Quitar</button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <button onClick={() => setIsModalOpen(true)} className="btn btn-outline btn-sm mt-4 w-full">+ Agregar más productos</button>
                </div>
            )}

            {isModalOpen && (
                <ProductSelectionModal 
                    existingItems={[]} // Simplified for now
                    onClose={() => setIsModalOpen(false)} 
                    onAddItems={handleAddItems} 
                />
            )}
        </div>
    );
}
