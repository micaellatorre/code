import type { ComponentType, SVGProps } from "react"
import {
  ArrowsRightLeftIcon,
  CalendarIcon,
  CircleStackIcon,
  CurrencyDollarIcon,
  BanknotesIcon,
  DevicePhoneMobileIcon,
  MapPinIcon,
  ShoppingCartIcon,
  Squares2X2Icon,
  UserGroupIcon,
  UsersIcon,
  WrenchScrewdriverIcon,
  BuildingStorefrontIcon,
} from "@heroicons/react/24/outline"
import type { Role } from "@/lib/auth/roles"

export type DashboardNavigationIcon = ComponentType<SVGProps<SVGSVGElement>>

export type DashboardNavigationItem = {
  key: string
  label: string
  href: string
  icon: DashboardNavigationIcon
  allowedRoles: Role[]
  quickAddHref?: string
  quickAddLabel?: string
}

export type DashboardNavigationGroup = {
  key: string
  label?: string
  items: DashboardNavigationItem[]
}

export const dashboardNavigationGroups: DashboardNavigationGroup[] = [
  {
    key: "home",
    items: [
      {
        key: "dashboard",
        label: "Dashboard",
        href: "/dashboard",
        icon: Squares2X2Icon,
        allowedRoles: ["ADMIN", "SOCIO"],
      },
    ],
  },
  {
    key: "commercial",
    label: "Comercial",
    items: [
      {
        key: "sales",
        label: "Ventas",
        href: "/dashboard/sales",
        icon: CurrencyDollarIcon,
        allowedRoles: ["ADMIN", "VENDEDOR", "SOCIO"],
        quickAddHref: "/dashboard/sales/new",
        quickAddLabel: "Nueva venta",
      },
      {
        key: "appointments",
        label: "Citas",
        href: "/dashboard/appointments",
        icon: CalendarIcon,
        allowedRoles: ["ADMIN", "VENDEDOR"],
        quickAddHref: "/dashboard/appointments/new",
        quickAddLabel: "Nueva cita",
      },
      {
        key: "buyers",
        label: "Clientes",
        href: "/dashboard/buyers",
        icon: UsersIcon,
        allowedRoles: ["ADMIN", "VENDEDOR"],
        quickAddHref: "/dashboard/buyers/new",
        quickAddLabel: "Nuevo cliente",
      },
      {
        key: "trade-in",
        label: "Plan Canje",
        href: "/dashboard/trade-in",
        icon: ArrowsRightLeftIcon,
        allowedRoles: ["ADMIN", "VENDEDOR"],
      },
    ],
  },
  {
    key: "inventory",
    label: "Inventario",
    items: [
      {
        key: "products",
        label: "Productos",
        href: "/dashboard/products",
        icon: DevicePhoneMobileIcon,
        allowedRoles: ["ADMIN", "VENDEDOR", "STOCK", "SOCIO"],
        quickAddHref: "/dashboard/products/new",
        quickAddLabel: "Nuevo producto",
      },
      {
        key: "purchases",
        label: "Compras",
        href: "/dashboard/purchases",
        icon: ShoppingCartIcon,
        allowedRoles: ["ADMIN"],
        quickAddHref: "/dashboard/purchases/new",
        quickAddLabel: "Nueva compra",
      },
      {
        key: "suppliers",
        label: "Proveedores",
        href: "/dashboard/suppliers",
        icon: BuildingStorefrontIcon,
        allowedRoles: ["ADMIN", "STOCK"],
        quickAddHref: "/dashboard/suppliers/new",
        quickAddLabel: "Nuevo proveedor",
      },
      {
        key: "service-orders",
        label: "Servicio Técnico",
        href: "/dashboard/service-orders",
        icon: WrenchScrewdriverIcon,
        allowedRoles: ["ADMIN"],
        quickAddHref: "/dashboard/service-orders/new",
        quickAddLabel: "Nueva orden de servicio",
      },
    ],
  },
  {
    key: "administration",
    label: "Administración",
    items: [
      {
        key: "cash",
        label: "Caja",
        href: "/dashboard/cash",
        icon: BanknotesIcon,
        allowedRoles: ["ADMIN", "SOCIO"],
        quickAddHref: "/dashboard/cash/new",
        quickAddLabel: "Nuevo movimiento",
      },
      {
        key: "branches",
        label: "Sucursales",
        href: "/dashboard/branches",
        icon: MapPinIcon,
        allowedRoles: ["ADMIN", "SOCIO"],
      },
      {
        key: "users",
        label: "Mi Equipo",
        href: "/dashboard/users",
        icon: UserGroupIcon,
        allowedRoles: ["ADMIN"],
      },
      {
        key: "database",
        label: "Base Datos",
        href: "/dashboard/database",
        icon: CircleStackIcon,
        allowedRoles: ["ADMIN", "SOCIO", "VENDEDOR", "STOCK"],
      },
    ],
  },
]

export function isDashboardNavigationItemActive(
  pathname: string,
  href: string
) {
  return pathname === href || pathname.startsWith(`${href}/`)
}

export function findDashboardNavigationItemByPath(
  pathname: string,
  items: DashboardNavigationItem[]
) {
  return items
    .filter((item) => isDashboardNavigationItemActive(pathname, item.href))
    .sort((a, b) => b.href.length - a.href.length)[0]
}

export function flattenDashboardNavigation(
  groups: DashboardNavigationGroup[]
) {
  return groups.flatMap((group) => group.items)
}
