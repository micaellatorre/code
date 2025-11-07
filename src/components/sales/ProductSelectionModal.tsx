
'use client';

import { SaleItemDraft } from '@/app/sales/new/page';
import { Product, ProductType, SaleItemKind } from '@prisma/client';
import { useState, useEffect, useMemo, useCallback } from 'react';

interface ProductSelectionModalProps {
    existingItems: SaleItemDraft[];
    onClose: () => void;
    onAddItems: (items: SaleItemDraft[]) => void;
}

// A simple debounce function
function debounce<F extends (...args: any[]) => any>(func: F, waitFor: number) {
    let timeout: NodeJS.Timeout;
    return (...args: Parameters<F>): void => {
        clearTimeout(timeout);
        timeout = setTimeout(() => func(...args), waitFor);
    };
}

type SelectionDraft = Omit<SaleItemDraft, '_id' | 'product'> & { product: Product };

export default function ProductSelectionModal({ existingItems, onClose, onAddItems }: ProductSelectionModalProps) {
    const [products, setProducts] = useState<Product[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [query, setQuery] = useState('');
    const [typeFilter, setTypeFilter] = useState<ProductType | 'ALL'>('ALL');
    const [selection, setSelection] = useState<Record<string, SelectionDraft>>({});

    const fetchProducts = async (q: string, type: ProductType | 'ALL') => {
        setIsLoading(true);
        let url = '/api/products?state=EN_STOCK';
        if (q) url += `&q=${encodeURIComponent(q)}`;
        if (type !== 'ALL') url += `&type=${type}`;

        
        try {
            console.log(url)
            const res = await fetch(url);
            if (res.ok) {
                const data = await res.json();
                console.log('data', data.body)
                setProducts(data);
            }
        } catch (error) {
            console.error('Failed to fetch products', error);
        }
        setIsLoading(false);
    };

    const debouncedFetch = useCallback(debounce(fetchProducts, 300), []);

    useEffect(() => {
        debouncedFetch(query, typeFilter);
    }, [query, typeFilter, debouncedFetch]);

    const availableStock = useMemo(() => {
        const stockMap = new Map<string, number>();
        products.forEach(p => stockMap.set(p.id, p.stock));
        existingItems.forEach(item => {
            if (stockMap.has(item.productId)) {
                stockMap.set(item.productId, stockMap.get(item.productId)! - item.units);
            }
        });
        return stockMap;
    }, [products, existingItems]);

    const handleToggleSelection = (product: Product, isSelected: boolean) => {
        const newSelection = { ...selection };
        if (isSelected) {
            newSelection[product.id] = {
                productId: product.id,
                product: product,
                units: 1,
                unitPrice: product.salePrice.toString(),
                unitCost: product.costPrice.toString(),
                extraCost: '0',
                kind: product.type === 'PHONE' ? 'NORMAL' : 'NORMAL',
            };
        } else {
            delete newSelection[product.id];
        }
        setSelection(newSelection);
    };

    const handleQuantityChange = (productId: string, units: number) => {
        const stock = availableStock.get(productId) || 0;
        const cappedUnits = Math.max(1, Math.min(units, stock));
        setSelection(prev => ({
            ...prev,
            [productId]: { ...prev[productId], units: cappedUnits },
        }));
    };

    const handleConfirm = () => {
        const newItems: SaleItemDraft[] = Object.values(selection).map(draft => ({
            ...draft,
            _id: `${draft.productId}-${Date.now()}` // simple unique id for React key
        }));
        onAddItems(newItems);
    };

    return (
        <div className="modal modal-open">
            <div className="modal-box w-11/12 max-w-5xl">
                <button onClick={onClose} className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2">X</button>
                <h3 className="font-bold text-lg">Agregar Items a la Venta</h3>

                {/* Toolbar */}
                <div className="flex flex-wrap gap-2 items-center my-4 p-2 bg-base-200 rounded-box">
                    <input 
                        type="text"
                        placeholder="Buscar por modelo..."
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                        className="input input-bordered input-sm flex-grow"
                    />
                    <div className="join">
                        <button onClick={() => setTypeFilter('ALL')} className={`btn btn-sm join-item ${typeFilter === 'ALL' && 'btn-active'}`}>Todos</button>
                        <button onClick={() => setTypeFilter('PHONE')} className={`btn btn-sm join-item ${typeFilter === 'PHONE' && 'btn-active'}`}>Teléfonos</button>
                        <button onClick={() => setTypeFilter('ACCESSORY')} className={`btn btn-sm join-item ${typeFilter === 'ACCESSORY' && 'btn-active'}`}>Accesorios</button>
                    </div>
                </div>

                {/* Products Table */}
                <div className="overflow-x-auto h-96">
                    {isLoading ? (
                        <div className="flex justify-center items-center h-full"><span className="loading loading-lg"></span></div>
                    ) : (
                        <table className="table table-pin-rows table-sm">
                            <thead>
                                <tr>
                                    <th></th>
                                    <th>Producto</th>
                                    <th>Stock Disp.</th>
                                    <th>Cantidad</th>
                                </tr>
                            </thead>
                            <tbody>
                                {products.map(p => {
                                    const currentStock = availableStock.get(p.id) || 0;
                                    const isSelected = !!selection[p.id];
                                    if (currentStock <= 0 && !isSelected) return null; // Hide if out of stock and not selected

                                    return (
                                        <tr key={p.id} className={isSelected ? 'bg-success/20' : ''}>
                                            <td><input type="checkbox" checked={isSelected} onChange={(e) => handleToggleSelection(p, e.target.checked)} className="checkbox checkbox-sm" disabled={currentStock <= 0 && !isSelected} /></td>
                                            <td>
                                                <div className="font-bold">{p.modelName}</div>
                                                <div className="text-xs opacity-70">{p.color || ''} {p.capacityGB ? `${p.capacityGB}GB` : ''}</div>
                                            </td>
                                            <td><span className="badge badge-ghost">{currentStock}</span></td>
                                            <td>
                                                {isSelected && (
                                                    <input 
                                                        type="number"
                                                        value={selection[p.id].units}
                                                        onChange={e => handleQuantityChange(p.id, parseInt(e.target.value))}
                                                        className="input input-bordered input-xs w-20"
                                                        min={1}
                                                        max={currentStock}
                                                    />
                                                )}
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    )}
                </div>

                {/* Actions */}
                <div className="modal-action">
                    <button onClick={onClose} className="btn btn-ghost">Cancelar</button>
                    <button onClick={handleConfirm} className="btn btn-primary" disabled={Object.keys(selection).length === 0}>Agregar {Object.keys(selection).length} Items</button>
                </div>
            </div>
        </div>
    );
}
