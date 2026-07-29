export type StockRotation = {
  value: 1 | 0 | -1
  label: "Alta" | "Media" | "Baja"
  daysInStock: number
}

const DAY_MS = 24 * 60 * 60 * 1000

export function getStockRotation(
  createdAt: Date | string,
  highMaxDays: number,
  mediumMaxDays: number,
  now: Date = new Date(),
): StockRotation {
  const created = createdAt instanceof Date ? createdAt : new Date(createdAt)
  const daysInStock = Number.isFinite(created.getTime())
    ? Math.max(0, Math.floor((now.getTime() - created.getTime()) / DAY_MS))
    : 0

  if (daysInStock <= highMaxDays) {
    return { value: 1, label: "Alta", daysInStock }
  }

  if (daysInStock <= mediumMaxDays) {
    return { value: 0, label: "Media", daysInStock }
  }

  return { value: -1, label: "Baja", daysInStock }
}
