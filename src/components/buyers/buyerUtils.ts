import type { BuyerType } from "@prisma/client"
import { isBuyerType } from "./buyerTypes"
import type { BuyersFilters, SerializedBuyer } from "./types"

export function normalizeInstagram(value: string | null | undefined) {
  const normalized = (value ?? "").trim().replace(/^@+/, "")
  return normalized || null
}

export function formatArgentina(iso: string | null) {
  if (!iso) return "-"
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return "-"

  return date.toLocaleDateString("es-AR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
}

export function getBuyerCode(buyer: Pick<SerializedBuyer, "id">) {
  return `#${buyer.id.slice(-4).toUpperCase()}`
}

export function getBuyerContactName(buyer: Pick<SerializedBuyer, "name" | "surname">) {
  return [buyer.name, buyer.surname].filter(Boolean).join(" ").trim()
}

export function getBuyerDisplayName(buyer: SerializedBuyer) {
  const contactName = getBuyerContactName(buyer)
  if (buyer.type === "MAYORISTA" && buyer.businessName) return buyer.businessName
  return contactName || buyer.businessName || "Sin nombre"
}

export function getBuyerSecondaryName(buyer: SerializedBuyer) {
  if (buyer.type !== "MAYORISTA" || !buyer.businessName) return null
  return getBuyerContactName(buyer) || null
}

export function getBuyerMainDocument(buyer: SerializedBuyer) {
  if (buyer.type === "MAYORISTA") return buyer.cuit || "Sin CUIT"
  return buyer.dni || "Sin DNI"
}

export function getBuyerSecondaryDocument(buyer: SerializedBuyer) {
  if (buyer.type === "MAYORISTA" && buyer.dni) return `DNI contacto: ${buyer.dni}`
  return null
}

export function formatBuyerLocation(buyer: SerializedBuyer) {
  return [buyer.province, buyer.city].filter(Boolean).join(" / ")
}

export function formatBuyerAddress(buyer: SerializedBuyer) {
  return [buyer.addressStreet, buyer.addressNumber].filter(Boolean).join(" ")
}

export function hasBuyerContact(buyer: SerializedBuyer) {
  return Boolean(buyer.phone || normalizeInstagram(buyer.instagram) || buyer.email)
}

export function isDateChanged(createdAt: string | null, updatedAt: string | null) {
  if (!createdAt || !updatedAt) return false

  const created = new Date(createdAt)
  const updated = new Date(updatedAt)
  if (Number.isNaN(created.getTime()) || Number.isNaN(updated.getTime())) return false

  return created.getTime() !== updated.getTime()
}

export function normalizeBuyers(input: unknown[]): SerializedBuyer[] {
  return (Array.isArray(input) ? input : []).map((raw) => {
    const buyer = raw as Partial<SerializedBuyer> & { type?: unknown }

    return {
      id: String(buyer.id ?? ""),
      tenantId: String(buyer.tenantId ?? ""),
      type: isBuyerType(buyer.type) ? buyer.type : "MINORISTA",
      name: String(buyer.name ?? ""),
      surname: buyer.surname ?? null,
      businessName: buyer.businessName ?? null,
      dob: buyer.dob ?? null,
      province: buyer.province ?? null,
      city: buyer.city ?? null,
      postalCode: buyer.postalCode ?? null,
      notes: buyer.notes ?? null,
      phone: buyer.phone ?? null,
      instagram: normalizeInstagram(buyer.instagram),
      email: buyer.email ?? null,
      addressStreet: buyer.addressStreet ?? null,
      addressNumber: buyer.addressNumber ?? null,
      cuit: buyer.cuit ?? null,
      dni: buyer.dni ?? null,
      createdAt: buyer.createdAt ?? null,
      updatedAt: buyer.updatedAt ?? null,
    }
  })
}

export function getBuyerSearchText(buyer: SerializedBuyer) {
  return [
    buyer.id,
    buyer.type,
    buyer.name,
    buyer.surname,
    buyer.businessName,
    buyer.phone,
    buyer.instagram,
    buyer.email,
    buyer.cuit,
    buyer.dni,
    buyer.province,
    buyer.city,
    buyer.postalCode,
    buyer.addressStreet,
    buyer.addressNumber,
    buyer.notes,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
}

function includes(value: string | null | undefined, query: string) {
  return !query || (value ?? "").toLowerCase().includes(query.toLowerCase())
}

export function matchesBuyerFilters(buyer: SerializedBuyer, filters: BuyersFilters, searchQuery: string) {
  const query = searchQuery.trim().toLowerCase()
  if (query && !getBuyerSearchText(buyer).includes(query)) return false
  if (filters.type !== "ALL" && buyer.type !== filters.type) return false
  if (!includes([buyer.name, buyer.surname, buyer.businessName].filter(Boolean).join(" "), filters.customer)) return false
  if (!includes(buyer.phone, filters.phone)) return false
  if (!includes(buyer.instagram, filters.instagram)) return false
  if (!includes(buyer.email, filters.email)) return false
  if (!includes(buyer.cuit, filters.cuit)) return false
  if (!includes(buyer.dni, filters.dni)) return false
  if (!includes(buyer.province, filters.province)) return false
  if (!includes(buyer.city, filters.city)) return false

  return true
}

export function toBuyerType(value: unknown): BuyerType {
  return isBuyerType(value) ? value : "MINORISTA"
}
