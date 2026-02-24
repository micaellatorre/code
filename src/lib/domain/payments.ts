// code/src/lib/domain/payments.ts
export const PAYMENT_METHODS = [
  "EFECTIVO_USD",
  "EFECTIVO_ARS",
  "TRANSFERENCIA_USD",
  "TRANSFERENCIA_ARS",
  "TARJETA_USD",
  "TARJETA_ARS",
] as const;

export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const CURRENCIES = ["USD", "ARS"] as const;
export type Currency = (typeof CURRENCIES)[number];