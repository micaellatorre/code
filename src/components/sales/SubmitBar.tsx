
'use client';

import { XCircleIcon } from '@heroicons/react/24/solid'

interface SubmitBarProps {
    disabled: boolean;
    reserveDisabled?: boolean;
    error: string | null;
    onSubmit: () => void;
    onReserve?: () => void;
    isSubmitting: boolean;
    isReserving?: boolean;
}

export default function SubmitBar({
    disabled,
    reserveDisabled = false,
    error,
    onSubmit,
    onReserve,
    isSubmitting,
    isReserving = false,
}: SubmitBarProps) {
    return (
        <div className="card bg-base-100 border border-base-content/50">
            <div className="card-body">
                {error && (
                    <div role="alert" className="alert alert-error">
                        <XCircleIcon className="stroke-current shrink-0 h-6 w-6" />
                        <span>{error}</span>
                    </div>
                )}

                <div className="card-actions flex flex-col w-full">
                    <button 
                        onClick={onSubmit}
                        className="btn btn-primary w-full"
                        disabled={disabled || isSubmitting || isReserving}
                    >
                        {isSubmitting ? (
                            <><span className="loading loading-spinner"></span> Creando Venta...</>
                        ) : (
                            'Confirmar Venta'
                        )}
                    </button>
                    {onReserve ? (
                        <button
                            onClick={onReserve}
                            className="btn btn-warning w-full"
                            disabled={reserveDisabled || isSubmitting || isReserving}
                        >
                            {isReserving ? (
                                <><span className="loading loading-spinner"></span> Registrando Seña...</>
                            ) : (
                                'Señar'
                            )}
                        </button>
                    ) : null}
                </div>
            </div>
        </div>
    );
}
