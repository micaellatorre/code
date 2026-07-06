const ARGENTINA_PROVINCES = [
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
]

function normalizeProvinceText(value) {
  return String(value ?? "")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
}

function getProvinceByCode(code) {
  if (!code) return null
  return ARGENTINA_PROVINCES.find((province) => province.code === String(code).trim().toUpperCase()) ?? null
}

function getProvinceByName(name) {
  const normalized = normalizeProvinceText(name)
  return ARGENTINA_PROVINCES.find((province) => normalizeProvinceText(province.name) === normalized) ?? null
}

module.exports = {
  ARGENTINA_PROVINCES,
  getProvinceByCode,
  getProvinceByName,
  normalizeProvinceText,
}
