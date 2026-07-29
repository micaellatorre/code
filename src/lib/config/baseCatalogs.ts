export const BASE_DEVICE_MODELS = [
  "iPhone 11",
  "iPhone 11 Pro",
  "iPhone 11 Pro Max",
  "iPhone 12 mini",
  "iPhone 12",
  "iPhone 12 Pro",
  "iPhone 12 Pro Max",
  "iPhone 13 mini",
  "iPhone 13",
  "iPhone 13 Pro",
  "iPhone 13 Pro Max",
  "iPhone 14",
  "iPhone 14 Plus",
  "iPhone 14 Pro",
  "iPhone 14 Pro Max",
  "iPhone 15",
  "iPhone 15 Plus",
  "iPhone 15 Pro",
  "iPhone 15 Pro Max",
  "iPhone 16e",
  "iPhone 16",
  "iPhone 16 Plus",
  "iPhone 16 Pro",
  "iPhone 16 Pro Max",
  "iPhone 17e",
  "iPhone 17",
  "iPhone Air",
  "iPhone 17 Pro",
  "iPhone 17 Pro Max",
  "Samsung S25",
  "Samsung S26 Ultra",
  'MacBook Air M5 15" 16/512 GB',
  "PlayStation 5 Digital",
] as const

export const DEVICE_MODEL_ALIASES = [
  { alias: "iPhone 17 E", target: "iPhone 17e" },
  { alias: "iPhone 16 E", target: "iPhone 16e" },
] as const

export const BASE_ACCESSORY_MODELS_EXPLICIT = [
  "Fuente 20 W Original",
  "Fuente 20 W Gen\u00e9rico",
  "Fuente 40 W Original",
  "Cable USB-C a USB-C Original",
  "Cable USB-C a USB-C Gen\u00e9rico",
  "Cable USB-C a Lightning Original",
  "Cable USB-C a Lightning Gen\u00e9rico",
  "Adaptador universal",
  "AirPods Pro 2",
  "Battery Pack",
  "Bolsa",
] as const

export const ACCESSORY_MODEL_ALIASES = [
  { alias: "Cable C a C Original", target: "Cable USB-C a USB-C Original" },
  { alias: "Cable C a C gen\u00e9rico", target: "Cable USB-C a USB-C Gen\u00e9rico" },
  { alias: "Cable C a L original", target: "Cable USB-C a Lightning Original" },
  { alias: "Cable C a L gen\u00e9rico", target: "Cable USB-C a Lightning Gen\u00e9rico" },
  { alias: "Air Pods Pro 2", target: "AirPods Pro 2" },
  { alias: "adaptador universal", target: "Adaptador universal" },
  { alias: "Bolsas", target: "Bolsa" },
] as const

export const COMPATIBLE_IPHONE_MODELS = [
  "iPhone 11",
  "iPhone 11 Pro",
  "iPhone 11 Pro Max",
  "iPhone 12",
  "iPhone 12 Pro",
  "iPhone 12 Pro Max",
  "iPhone 13",
  "iPhone 13 Pro",
  "iPhone 13 Pro Max",
  "iPhone 14",
  "iPhone 14 Plus",
  "iPhone 14 Pro",
  "iPhone 14 Pro Max",
  "iPhone 15",
  "iPhone 15 Plus",
  "iPhone 15 Pro",
  "iPhone 15 Pro Max",
  "iPhone 16e",
  "iPhone 16",
  "iPhone 16 Plus",
  "iPhone 16 Pro",
  "iPhone 16 Pro Max",
  "iPhone 17e",
  "iPhone 17",
  "iPhone Air",
  "iPhone 17 Pro",
  "iPhone 17 Pro Max",
] as const

export const GENERATED_ACCESSORY_MODELS = COMPATIBLE_IPHONE_MODELS.flatMap((model) => [
  `Funda ${model}`,
  `Vidrio Templado ${model}`,
] as const)

export const BASE_ACCESSORY_MODELS = [
  ...BASE_ACCESSORY_MODELS_EXPLICIT,
  ...GENERATED_ACCESSORY_MODELS,
] as const

export const BASE_CAPACITIES = [
  { capacityGB: 64, label: "64 GB" },
  { capacityGB: 128, label: "128 GB" },
  { capacityGB: 256, label: "256 GB" },
  { capacityGB: 512, label: "512 GB" },
  { capacityGB: 1024, label: "1 TB" },
] as const

export const BASE_MEASURES: readonly { label: string; millimeters: number }[] = []

export const BASE_COLORS = [
  { name: "Black", hexColor: "#1D1D1F", aliases: ["black", "negro"] },
  { name: "White", hexColor: "#F5F5F0", aliases: ["white", "blanco"] },
  { name: "Silver", hexColor: "#D9D9D6", aliases: ["silver", "plata", "color plata"] },
  { name: "Gray", hexColor: "#8E8E93", aliases: ["gray", "grey", "gris"] },
  { name: "Space Gray", hexColor: "#53565A", aliases: ["space gray", "gris espacial"] },
  { name: "Graphite", hexColor: "#4B4B4D", aliases: ["graphite", "grafito"] },
  { name: "Midnight", hexColor: "#1F252D", aliases: ["midnight", "medianoche"] },
  { name: "Starlight", hexColor: "#F2E6D8", aliases: ["starlight", "blanco estelar"] },
  { name: "Gold", hexColor: "#D4B58C", aliases: ["gold", "dorado"] },
  { name: "Rose Gold", hexColor: "#E7B8A8", aliases: ["rose gold", "oro rosa"] },
  { name: "(PRODUCT)RED", hexColor: "#D70015", aliases: ["(product)red", "product red", "red", "rojo"] },
  { name: "Blue", hexColor: "#5B7FA3", aliases: ["blue", "azul", "az\u00fal"] },
  { name: "Sky Blue", hexColor: "#A9CFE7", aliases: ["sky blue", "azul cielo", "celeste"] },
  { name: "Mist Blue", hexColor: "#A7BED3", aliases: ["mist blue", "azul neblina"] },
  { name: "Mystic Blue", hexColor: "#7F9DB9", aliases: ["mystic blue", "mistic blue"] },
  { name: "Deep Blue", hexColor: "#1F365C", aliases: ["deep blue", "azul profundo"] },
  { name: "Sierra Blue", hexColor: "#9BB5CE", aliases: ["sierra blue", "azul sierra"] },
  { name: "Pacific Blue", hexColor: "#2E5B69", aliases: ["pacific blue", "azul pac\u00edfico"] },
  { name: "Blue Titanium", hexColor: "#4B5563", aliases: ["blue titanium", "titanio azul"] },
  { name: "Ultramarine", hexColor: "#4F63A6", aliases: ["ultramarine", "ultra marine", "ultramarino"] },
  { name: "Teal", hexColor: "#3C7F7B", aliases: ["teal", "verde azulado"] },
  { name: "Green", hexColor: "#6E8067", aliases: ["green", "verde"] },
  { name: "Alpine Green", hexColor: "#576856", aliases: ["alpine green", "verde alpino"] },
  { name: "Midnight Green", hexColor: "#4E5851", aliases: ["midnight green", "verde medianoche"] },
  { name: "Sage", hexColor: "#A3B18A", aliases: ["sage", "salvia"] },
  { name: "Mint Green", hexColor: "#B7D3C6", aliases: ["mint green", "verde menta"] },
  { name: "Pink", hexColor: "#E8B7C8", aliases: ["pink", "rosa"] },
  { name: "Soft Pink", hexColor: "#F2C9D2", aliases: ["soft pink", "rosa p\u00e1lido", "rosa palido"] },
  { name: "Purple", hexColor: "#A79AC1", aliases: ["purple", "p\u00farpura", "purpura", "violeta"] },
  { name: "Deep Purple", hexColor: "#4B3F56", aliases: ["deep purple", "morado oscuro"] },
  { name: "Lavender", hexColor: "#C6B6D7", aliases: ["lavender", "lavander", "lavanda"] },
  { name: "Yellow", hexColor: "#F3D36A", aliases: ["yellow", "amarillo"] },
  { name: "Orange", hexColor: "#E8753D", aliases: ["orange", "naranja"] },
  { name: "Cosmic Orange", hexColor: "#D96B3B", aliases: ["cosmic orange", "naranja c\u00f3smico", "naranja cosmico"] },
  { name: "Coral", hexColor: "#F26B5B", aliases: ["coral"] },
  { name: "Natural Titanium", hexColor: "#B6B0A7", aliases: ["natural", "natural titanium", "titanio natural"] },
  { name: "Desert Titanium", hexColor: "#C2A78B", aliases: ["desert", "dessert", "desert titanium", "titanio desierto", "titanio color desierto"] },
  { name: "White Titanium", hexColor: "#E5E1DB", aliases: ["white titanium", "titanio blanco"] },
  { name: "Black Titanium", hexColor: "#3B3B3D", aliases: ["black titanium", "titanio negro"] },
  { name: "Light Gold", hexColor: "#E2D0A8", aliases: ["light gold", "oro claro"] },
  { name: "Cloud White", hexColor: "#F2F1ED", aliases: ["cloud white", "blanco nube"] },
  { name: "Space Black", hexColor: "#242426", aliases: ["space black", "negro espacial"] },
] as const

export type BaseLoadCategory = "devices" | "accessories" | "capacities" | "measures" | "colors"

export const BASE_LOAD_COUNTS: Record<BaseLoadCategory, number> = {
  devices: BASE_DEVICE_MODELS.length,
  accessories: BASE_ACCESSORY_MODELS.length,
  capacities: BASE_CAPACITIES.length,
  measures: BASE_MEASURES.length,
  colors: BASE_COLORS.length,
}
