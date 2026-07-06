import type { Buyer, BuyerType } from "@prisma/client"
import { normalizePostalCode } from "@/lib/domain/argentina/provinces"

export const BUYER_TYPES: BuyerType[] = ["MINORISTA", "MAYORISTA"]

export function isBuyerType(value: unknown): value is BuyerType {
  return value === "MINORISTA" || value === "MAYORISTA"
}

export function normalizeBuyerType(value: unknown): BuyerType {
  return isBuyerType(value) ? value : "MINORISTA"
}

export function normalizeNullableString(value: unknown) {
  if (value == null) return null
  const text = String(value).trim()
  return text ? text : null
}

export function normalizeInstagramForStorage(value: unknown) {
  const normalized = normalizeNullableString(value)?.replace(/^@+/, "") ?? null
  return normalized || null
}

export { normalizePostalCode }

export function parseOptionalDate(value: unknown) {
  if (value == null || value === "") return null
  const date = new Date(String(value))
  if (Number.isNaN(date.getTime())) throw new Error("Fecha de nacimiento invalida")
  return date
}

export function validateBuyerRequiredFields(input: {
  type: BuyerType
  name: string | null
  surname: string | null
  businessName?: string | null
  cuit?: string | null
  dni?: string | null
}) {
  if (!input.name) throw new Error("El nombre es obligatorio.")
  if (!input.surname) throw new Error("El apellido es obligatorio.")

  if (input.type === "MINORISTA") {
    if (!input.dni) throw new Error("El DNI es obligatorio para clientes minoristas.")
    return
  }

  if (!input.businessName) throw new Error("La razon social es obligatoria para clientes mayoristas.")
  if (!input.cuit) throw new Error("El CUIT es obligatorio para clientes mayoristas.")
}

export function serializeBuyer(
  buyer: Buyer & {
    provinceRef?: { id: string; code: string; name: string } | null
    registeredBranch?: { id: string; code: string; name: string } | null
  },
) {
  return {
    id: buyer.id,
    tenantId: buyer.tenantId,
    type: buyer.type,
    name: buyer.name,
    surname: buyer.surname,
    businessName: buyer.businessName,
    dob: buyer.dob ? buyer.dob.toISOString() : null,
    province: buyer.provinceRef?.name ?? buyer.province,
    provinceLegacy: buyer.province,
    provinceId: buyer.provinceId,
    provinceRef: buyer.provinceRef ?? null,
    city: buyer.city,
    postalCode: buyer.postalCode,
    registeredBranchId: buyer.registeredBranchId,
    registeredBranch: buyer.registeredBranch ?? null,
    notes: buyer.notes,
    phone: buyer.phone,
    instagram: buyer.instagram,
    email: buyer.email,
    addressStreet: buyer.addressStreet,
    addressNumber: buyer.addressNumber,
    cuit: buyer.cuit,
    dni: buyer.dni,
    createdAt: buyer.createdAt ? buyer.createdAt.toISOString() : null,
    updatedAt: buyer.updatedAt ? buyer.updatedAt.toISOString() : null,
  }
}
