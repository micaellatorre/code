type DatabaseTabKey =
  | "cash"
  | "retail"
  | "wholesale"
  | "purchases"
  | "reservations"
  | "closers"
  | "service"
  | "audit"
  | "buyers"

export const databaseTabLabels: Record<DatabaseTabKey, string> = {
  cash: "Caja",
  retail: "Minorista",
  wholesale: "Mayorista",
  purchases: "Proveedores",
  reservations: "Guardados",
  closers: "Closers",
  service: "Serv. Tecnico",
  audit: "Trazabilidad",
  buyers: "Compradores",
}
