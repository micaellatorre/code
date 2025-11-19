
'use client';

import { Buyer } from "@prisma/client";
import { useState, useEffect, useCallback } from "react";

interface BuyerSectionProps {
    selectedBuyer: Buyer | null;
    setSelectedBuyer: (buyer: Buyer | null) => void;
}

// A simple debounce function
function debounce<F extends (...args: any[]) => any>(func: F, waitFor: number) {
    let timeout: NodeJS.Timeout;
    return (...args: Parameters<F>): void => {
        clearTimeout(timeout);
        timeout = setTimeout(() => func(...args), waitFor);
    };
}

export default function BuyerSection({ selectedBuyer, setSelectedBuyer }: BuyerSectionProps) {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<Buyer[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [showNewBuyerForm, setShowNewBuyerForm] = useState(false);
    const [newBuyer, setNewBuyer] = useState<Partial<Buyer>>({ name: '' });

    const searchBuyers = async (searchQuery: string) => {
        if (searchQuery.length < 2) {
            setResults([]);
            return;
        }
        setIsLoading(true);
        try {
            const res = await fetch(`/api/buyers/search?q=${encodeURIComponent(searchQuery)}`);
            if (res.ok) {
                const data = await res.json();
                setResults(data.results);
            }
        } catch (error) {
            console.error('Failed to search buyers', error);
        }
        setIsLoading(false);
    };

    const debouncedSearch = useCallback(debounce(searchBuyers, 300), []);

    useEffect(() => {
        debouncedSearch(query);
    }, [query, debouncedSearch]);

    const handleCreateBuyer = async () => {
        setIsLoading(true);
        try {
            const res = await fetch('/api/buyers', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newBuyer),
            });
            if (res.ok) {
                const { buyer: createdBuyer } = await res.json();
                setSelectedBuyer(createdBuyer);
                setShowNewBuyerForm(false);
                setQuery('');
            }
        } catch (error) {
            console.error('Failed to create buyer', error);
        }
        setIsLoading(false);
    };

    if (selectedBuyer) {
        return (
            <div className="card bg-base-100 shadow-md p-4">
                <h2 className="font-bold text-lg">1. Datos del Comprador</h2>
                <div className="flex items-center justify-between mt-2 p-2 bg-base-200 rounded-lg">
                    <div>
                        <p className="font-semibold">{selectedBuyer.name} {selectedBuyer.surname}</p>
                        <p className="text-sm text-base-content/70">DNI: {selectedBuyer.dni || 'N/A'} - Instagram: {selectedBuyer.instagram || 'N/A'}</p>
                    </div>
                    <button onClick={() => setSelectedBuyer(null)} className="btn btn-sm btn-circle btn-ghost">X</button>
                </div>
            </div>
        );
    }

    return (
        <div className="card bg-base-100 shadow-md p-4">
            <h2 className="font-bold text-lg">1. Datos del Comprador</h2>
            <p className="text-sm text-base-content/70 mb-2">Ingresa el nombre, apellido o DNI del cliente</p>

            <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar cliente..."
                className="input input-bordered w-full"
            />

            {isLoading &&
                <div className="flex w-full items-center justify-center">
                    <span className="loading loading-spinner loading-sm mt-2"></span>
                </div>
            }


            {!isLoading && results.length > 0 && (
                <ul className="menu bg-base-200 rounded-box mt-2">
                    {results.map(buyer => (
                        <li key={buyer.id} onClick={() => { setSelectedBuyer(buyer); setQuery(''); }}>
                            <a>{buyer.name} {buyer.surname} - {buyer.dni}</a>
                        </li>
                    ))}
                </ul>
            )}

            {!isLoading && query.length > 2 && results.length === 0 && !showNewBuyerForm && (
                <div className="text-center p-4">
                    <p>No se encontraron clientes.</p>
                    <button onClick={() => { setShowNewBuyerForm(true); setNewBuyer({ name: query }); }} className="btn btn-primary btn-sm mt-2">Agregar Nuevo Cliente</button>
                </div>
            )}

            {showNewBuyerForm && (
                <div className="mt-4 p-4 border border-base-300 rounded-box">
                    <h3 className="font-semibold mb-2">Nuevo Cliente</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        <input type="text" placeholder="Nombre *" value={newBuyer.name || ''} onChange={e => setNewBuyer({ ...newBuyer, name: e.target.value })} className="input input-bordered" />
                        <input type="text" placeholder="Apellido" value={newBuyer.surname || ''} onChange={e => setNewBuyer({ ...newBuyer, surname: e.target.value })} className="input input-bordered" />
                        <input type="text" placeholder="DNI" value={newBuyer.dni || ''} onChange={e => setNewBuyer({ ...newBuyer, dni: e.target.value })} className="input input-bordered" />
                        <input type="text" placeholder="Instagram" value={newBuyer.instagram || ''} onChange={e => setNewBuyer({ ...newBuyer, instagram: e.target.value })} className="input input-bordered" />
                        <input type="text" placeholder="Teléfono" value={newBuyer.phone || ''} onChange={e => setNewBuyer({ ...newBuyer, phone: e.target.value })} className="input input-bordered" />
                        <input type="email" placeholder="Email" value={newBuyer.email || ''} onChange={e => setNewBuyer({ ...newBuyer, email: e.target.value })} className="input input-bordered" />
                        <input type="date" placeholder="Fecha de Nacimiento" value={newBuyer.dob ? new Date(newBuyer.dob).toISOString().split('T')[0] : ''} onChange={e => setNewBuyer({ ...newBuyer, dob: new Date(e.target.value) })} className="input input-bordered" />
                        <input type="text" placeholder="CUIT" value={newBuyer.cuit || ''} onChange={e => setNewBuyer({ ...newBuyer, cuit: e.target.value })} className="input input-bordered" />
                    </div>
                    <div className="mt-4 flex justify-end gap-2">
                        <button onClick={() => setShowNewBuyerForm(false)} className="btn btn-ghost">Cancelar</button>
                        <button onClick={handleCreateBuyer} className="btn btn-primary" disabled={isLoading || !newBuyer.name}>{isLoading ? 'Guardando...' : 'Guardar Cliente'}</button>
                    </div>
                </div>
            )}
        </div>
    );
}
