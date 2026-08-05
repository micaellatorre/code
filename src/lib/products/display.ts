export type ProductCatalogDisplayModel = {
  id: string
  type?: string | null
  name: string
  normalizedName?: string | null
  source?: string | null
  isActive?: boolean | null
}

export type ProductCatalogDisplayCapacity = {
  id: string
  capacityGB: number
  label: string
  source?: string | null
  isActive?: boolean | null
}

export type ProductCatalogDisplayColor = {
  id: string
  name: string
  hexColor: string
  source?: string | null
  isActive?: boolean | null
}

export type ProductCatalogDisplayProduct = {
  type?: string | null
  modelName?: string | null
  capacityGB?: number | string | null
  color?: string | null
  catalogModel?: ProductCatalogDisplayModel | null
  catalogCapacity?: ProductCatalogDisplayCapacity | null
  catalogColor?: ProductCatalogDisplayColor | null
}

export function formatCapacity(capacityGB: number | string | null | undefined) {
  if (capacityGB == null || capacityGB === "") return null
  const value = Number(capacityGB)
  if (!Number.isFinite(value) || value <= 0) return null
  if (Number.isInteger(value) && value >= 1024 && value % 1024 === 0) return `${value / 1024} TB`
  return `${value} GB`
}

export function getProductDisplayModel(product: ProductCatalogDisplayProduct | null | undefined) {
  return product?.catalogModel?.name?.trim() || product?.modelName?.trim() || "Sin modelo"
}

export function getProductDisplayCapacity(product: ProductCatalogDisplayProduct | null | undefined) {
  return product?.catalogCapacity?.label?.trim() || formatCapacity(product?.capacityGB) || null
}

export function getProductDisplayCapacityGB(product: ProductCatalogDisplayProduct | null | undefined) {
  if (product?.catalogCapacity?.capacityGB != null) return product.catalogCapacity.capacityGB
  if (product?.capacityGB == null || product.capacityGB === "") return null
  const value = Number(product.capacityGB)
  return Number.isFinite(value) ? value : null
}

export function getProductDisplayColor(product: ProductCatalogDisplayProduct | null | undefined) {
  return product?.catalogColor?.name?.trim() || product?.color?.trim() || null
}

export function getProductDisplayColorHex(product: ProductCatalogDisplayProduct | null | undefined) {
  return product?.catalogColor?.hexColor?.trim() || null
}

export function getProductDisplayParts(product: ProductCatalogDisplayProduct | null | undefined) {
  const type = product?.type?.toUpperCase()
  const model = getProductDisplayModel(product)
  const capacity = type === "PHONE" ? getProductDisplayCapacity(product) : null
  const color = getProductDisplayColor(product)
  return [model, capacity, color].filter((part): part is string => Boolean(part))
}

export function getProductDisplayLabel(product: ProductCatalogDisplayProduct | null | undefined) {
  return getProductDisplayParts(product).join(" - ")
}
