
'use client';

interface SubmitBarProps {
    disabled: boolean;
    error: string | null;
    onSubmit: () => void;
    isSubmitting: boolean;
}

export default function SubmitBar({ disabled, error, onSubmit, isSubmitting }: SubmitBarProps) {
    return (
        <div className="card bg-base-100 shadow-md">
            <div className="card-body">
                {error && (
                    <div role="alert" className="alert alert-error">
                        <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
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
