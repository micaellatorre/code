export type ProvinceOption = {
  id: string
  code: string
  name: string
}

export const POSTAL_CODE_ERROR_MESSAGE = "Ingresá un código postal argentino válido (CP de 4 dígitos o CPA)."

export const ARGENTINA_PROVINCES = [
  { id: "B", code: "B", name: "Buenos Aires" },
  { id: "K", code: "K", name: "Catamarca" },
  { id: "H", code: "H", name: "Chaco" },
  { id: "U", code: "U", name: "Chubut" },
  { id: "C", code: "C", name: "Ciudad Autónoma de Buenos Aires" },
  { id: "X", code: "X", name: "Córdoba" },
  { id: "W", code: "W", name: "Corrientes" },
  { id: "E", code: "E", name: "Entre Ríos" },
  { id: "P", code: "P", name: "Formosa" },
  { id: "Y", code: "Y", name: "Jujuy" },
  { id: "L", code: "L", name: "La Pampa" },
  { id: "F", code: "F", name: "La Rioja" },
  { id: "M", code: "M", name: "Mendoza" },
  { id: "N", code: "N", name: "Misiones" },
  { id: "Q", code: "Q", name: "Neuquén" },
  { id: "R", code: "R", name: "Río Negro" },
  { id: "A", code: "A", name: "Salta" },
  { id: "J", code: "J", name: "San Juan" },
  { id: "D", code: "D", name: "San Luis" },
  { id: "Z", code: "Z", name: "Santa Cruz" },
  { id: "S", code: "S", name: "Santa Fe" },
  { id: "G", code: "G", name: "Santiago del Estero" },
  { id: "V", code: "V", name: "Tierra del Fuego, Antártida e Islas del Atlántico Sur" },
  { id: "T", code: "T", name: "Tucumán" },
] as const satisfies readonly ProvinceOption[]

const byCode: Map<string, ProvinceOption> = new Map(ARGENTINA_PROVINCES.map((province) => [province.code, province]))
const byName: Map<string, ProvinceOption> = new Map(ARGENTINA_PROVINCES.map((province) => [normalizeProvinceText(province.name), province]))

export function normalizeProvinceText(value: string) {
  return value
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
}

export function getProvinceByCode(code: string | null | undefined) {
  if (!code) return null
  return byCode.get(code.trim().toUpperCase()) ?? null
}

export function getProvinceByName(name: string | null | undefined) {
  if (!name) return null
  return byName.get(normalizeProvinceText(name)) ?? null
}

export function getProvinceName(code: string | null | undefined) {
  return getProvinceByCode(code)?.name ?? null
}

export function isProvinceCode(value: unknown): value is string {
  return typeof value === "string" && byCode.has(value.trim().toUpperCase())
}

export function normalizeProvinceId(value: unknown) {
  if (value == null) return null
  const code = String(value).trim().toUpperCase()
  return code ? getProvinceByCode(code)?.id ?? null : null
}

export function normalizePostalCode(value: unknown) {
  if (value == null) return null
  const postalCode = String(value).trim().toUpperCase()
  if (!postalCode) return null
  if (!/^(?:\d{4}|[A-Z]\d{4}[A-Z]{3})$/.test(postalCode)) {
    throw new Error(POSTAL_CODE_ERROR_MESSAGE)
  }
  return postalCode
}
