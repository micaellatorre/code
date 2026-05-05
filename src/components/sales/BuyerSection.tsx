
'use client';

import type { Buyer } from "@prisma/client";
import { useState, useEffect, useCallback } from "react";
import { toArgDateInputValue, fromArgDateInputValue } from '@/lib/timezone';

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

function cleanDni(value: string | undefined) {
    return (value ?? '').replace(/\D/g, '').trim();
}

function isValidDni(value: string) {
    return /^\d{7,8}$/.test(value);
}

async function dniExists(dni: string) {
    try {
        const res = await fetch(`/api/buyers/search?q=${encodeURIComponent(dni)}`);
        if (!res.ok) return false;
        const data = await res.json();
        return Array.isArray(data.results) && data.results.some((buyer: Buyer) => cleanDni(buyer?.dni as any) === dni);
    } catch (error) {
        console.error('Failed to validate DNI uniqueness', error);
        return false;
    }
}

export default function BuyerSection({ selectedBuyer, setSelectedBuyer }: BuyerSectionProps) {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<Buyer[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [showNewBuyerForm, setShowNewBuyerForm] = useState(false);
    const [newBuyer, setNewBuyer] = useState<Partial<Buyer>>({ name: '' });
    const [formError, setFormError] = useState<string | null>(null);

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
        const name = newBuyer.name?.toString().trim() || '';
        const surname = newBuyer.surname?.toString().trim() || '';
        const rawDni = newBuyer.dni?.toString() || '';
        const dni = cleanDni(rawDni);

        if (!name || !surname || !dni) {
            setFormError('Complete los campos obligatorios: Nombre, Apellido y DNI.');
            return;
        }

        if (!isValidDni(dni)) {
            setFormError('DNI inválido. Debe ser un número de 7 u 8 dígitos.');
            return;
        }

        const duplicate = await dniExists(dni);
        if (duplicate) {
            setFormError('Ya existe un cliente con ese DNI.');
            return;
        }

        setFormError(null);
        setIsLoading(true);
        try {
            const res = await fetch('/api/buyers', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...newBuyer,
                    name,
                    surname,
                    dni,
                }),
            });
            if (res.ok) {
                const { buyer: createdBuyer } = await res.json();
                setSelectedBuyer(createdBuyer);
                setShowNewBuyerForm(false);
                setQuery('');
            } else {
                const errorText = await res.text();
                console.error('Failed to create buyer', errorText);
                setFormError('No se pudo crear el cliente. Verifique los datos.');
            }
        } catch (error) {
            console.error('Failed to create buyer', error);
            setFormError('No se pudo crear el cliente. Intente nuevamente.');
        }
        setIsLoading(false);
    };

    if (selectedBuyer) {
        return (
            <div className="card bg-base-100 border border-base-content/50 p-4">
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
        <div className="card bg-base-100 border border-base-content/50 p-4">
            <div className="flex flex-row justify-between items-start">
                <div className="flex flex-col">
                    <h2 className="font-bold text-lg">1. Datos del Comprador</h2>
                </div>
                {!isLoading && !showNewBuyerForm && (
                    <div className="text-center">
                        <button onClick={() => { setShowNewBuyerForm(true); setFormError(null); setNewBuyer({ name: query }); }} className="btn btn-primary btn-sm">Agregar Nuevo Cliente</button>
                    </div>
                )}
            </div>

            <p className="text-sm text-base-content/70 my-2">Ingresa el nombre, apellido o DNI del cliente</p>

            <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar cliente por nombre, apellido, DNI, ..."
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
                            <a>
                                <span className="text-base-content/50 uppercase">{buyer.id.slice(-4)}</span>
                                {buyer.name} {buyer.surname}
                                <span className="text-sm text-base-content/70 flex items-center gap-1 ml-2">
                                    {buyer.instagram && 
                                    // Instagram icon from https://www.svgrepo.com/svg/111199/instagram
                                    <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24"
                                    className="fill-primary shrink-0" ><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>}
                                    {buyer.instagram ?? <span className="text-sm text-base-content/40">Sin Instagram</span>}
                                </span>
                            </a>
                        </li>
                    ))}
                </ul>
            )}

            {!isLoading && query.length > 2 && results.length === 0 && !showNewBuyerForm && (
                <div className="text-center p-4">
                    <p>No se encontraron clientes.</p>
                </div>
            )}

            {showNewBuyerForm && (
                <div className="mt-4 p-4 border border-base-300 rounded-box">
                    <h3 className="font-semibold mb-2">Nuevo Cliente</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        <input type="text" placeholder="Nombre *" required value={newBuyer.name || ''} onChange={e => setNewBuyer({ ...newBuyer, name: e.target.value })} className="input input-bordered required:input-warning" />
                        <input type="text" placeholder="Apellido *" required value={newBuyer.surname || ''} onChange={e => setNewBuyer({ ...newBuyer, surname: e.target.value })} className="input input-bordered required:input-warning" />
                        <input type="text" placeholder="DNI *" required value={newBuyer.dni || ''} onChange={e => setNewBuyer({ ...newBuyer, dni: cleanDni(e.target.value) })} className="input input-bordered required:input-warning" />
                        <input type="text" placeholder="Instagram" value={newBuyer.instagram || ''} onChange={e => setNewBuyer({ ...newBuyer, instagram: e.target.value })} className="input input-bordered" />
                        <input type="text" placeholder="Teléfono" value={newBuyer.phone || ''} onChange={e => setNewBuyer({ ...newBuyer, phone: e.target.value })} className="input input-bordered" />
                        <input type="email" placeholder="Email" value={newBuyer.email || ''} onChange={e => setNewBuyer({ ...newBuyer, email: e.target.value })} className="input input-bordered" />
                        <input type="date" placeholder="Fecha de Nacimiento" value={newBuyer.dob ? toArgDateInputValue(newBuyer.dob) : ''} onChange={e => setNewBuyer({ ...newBuyer, dob: e.target.value ? fromArgDateInputValue(e.target.value) : undefined })} className="input input-bordered" />
                        <input type="text" placeholder="CUIT" value={newBuyer.cuit || ''} onChange={e => setNewBuyer({ ...newBuyer, cuit: e.target.value })} className="input input-bordered" />
                    </div>
                    {formError ? (
                        <div className="text-sm text-error mb-2">{formError}</div>
                    ) : null}
                    <div className="mt-4 flex justify-end gap-2">
                        <button onClick={() => { setShowNewBuyerForm(false); setFormError(null); }} className="btn btn-ghost">Cancelar</button>
                        <button
                            onClick={handleCreateBuyer}
                            className="btn btn-primary"
                            disabled={
                                isLoading ||
                                !newBuyer.name?.toString().trim() ||
                                !newBuyer.surname?.toString().trim() ||
                                !newBuyer.dni?.toString().trim()
                            }
                        >
                            {isLoading ? 'Guardando...' : 'Guardar Cliente'}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
