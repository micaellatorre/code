
'use client';

import { XCircleIcon } from '@heroicons/react/24/solid'

interface SubmitBarProps {
    disabled: boolean;
    error: string | null;
    onSubmit: () => void;
    isSubmitting: boolean;
}

export default function SubmitBar({ disabled, error, onSubmit, isSubmitting }: SubmitBarProps) {
    return (
        <div className="card bg-base-100 border border-base-content/50">
            <div className="card-body">
                {error && (
                    <div role="alert" className="alert alert-error">
                        <XCircleIcon className="stroke-current shrink-0 h-6 w-6" />
                        <span>{error}</span>
                    </div>
                )}

                <div className="card-actions">
                    <button 
                        onClick={onSubmit}
                        className="btn btn-primary w-full"
                        disabled={disabled || isSubmitting}
                    >
                        {isSubmitting ? (
                            <><span className="loading loading-spinner"></span> Creando Venta...</>
                        ) : (
                            'Confirmar Venta'
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
