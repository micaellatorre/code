"use client"

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { useEffect, useState } from 'react'
import {
  ArrowPathIcon,
  ArrowsRightLeftIcon,
  CalendarIcon,
  CurrencyDollarIcon,
  DevicePhoneMobileIcon,
  UsersIcon,
  CircleStackIcon,
  MapPinIcon,
  UserGroupIcon,
  WrenchScrewdriverIcon,
  ShoppingCartIcon,
  BuildingStorefrontIcon
} from '@heroicons/react/24/solid'
import type { Role } from '@/lib/auth/roles'

export interface BreadcrumbItem {
  /** Texto visible para este paso en el breadcrumb. */
  label: string
  /**
   * Ruta a la que debe enlazar este paso. Si no se especifica, se
   * interpretará como la página actual y el texto no será clicable.
   */
  href?: string
}

const sectionMenuItems = [
  {
    key: "purchases",
    label: "Compras",
    href: "/dashboard/purchases",
    icon: <ShoppingCartIcon className="size-5 shrink-0" />,
    allowedRoles: ["ADMIN"] as Role[],
  },
  {
    key: "suppliers",
    label: "Proveedores",
    href: "/dashboard/suppliers",
    icon: <BuildingStorefrontIcon className="size-5 shrink-0" />,
    allowedRoles: ["ADMIN", "STOCK"] as Role[],
  },
  {
    key: "buyers",
    label: "Clientes",
    href: "/dashboard/buyers",
    icon: <UsersIcon className="size-5 shrink-0" />,
    allowedRoles: ["ADMIN", "VENDEDOR"] as Role[],
  },
  {
    key: "appointments",
    label: "Citas",
    href: "/dashboard/appointments",
    icon: <CalendarIcon className="size-5 shrink-0" />,
    allowedRoles: ["ADMIN", "VENDEDOR"] as Role[],
  },
  {
    key: "products",
    label: "Productos",
    href: "/dashboard/products",
    icon: <DevicePhoneMobileIcon className="size-5 shrink-0" />,
    allowedRoles: ["ADMIN", "VENDEDOR", "STOCK", "SOCIO"] as Role[],
  },
  {
    key: "sales",
    label: "Ventas",
    href: "/dashboard/sales",
    icon: <CurrencyDollarIcon className="size-5 shrink-0" />,
    allowedRoles: ["ADMIN", "VENDEDOR", "SOCIO"] as Role[],
  },
  {
    key: "database",
    label: "Base de Datos",
    href: "/dashboard/database",
    icon: <CircleStackIcon className="size-5 shrink-0" />,
    allowedRoles: ["ADMIN", "SOCIO"] as Role[],
  },
  {
    key: "branches",
    label: "Sucursales",
    href: "/dashboard/branches",
    icon: <MapPinIcon className="size-5 shrink-0" />,
    allowedRoles: ["ADMIN"] as Role[],
  },
  {
    key: "users",
    label: "Mi Equipo",
    href: "/dashboard/users",
    icon: <UserGroupIcon className="size-5 shrink-0" />,
    allowedRoles: ["ADMIN"] as Role[],
  },
  {
    key: "service-orders",
    label: "Servicio Técnico",
    href: "/dashboard/service-orders",
    icon: <WrenchScrewdriverIcon className="size-5 shrink-0" />,
    allowedRoles: ["ADMIN"] as Role[],
  },
  {
    key: "trade-in",
    label: "Plan Canje",
    href: "/dashboard/trade-in",
    icon: <ArrowsRightLeftIcon className="size-5 shrink-0" />,
    allowedRoles: ["ADMIN", "VENDEDOR"] as Role[],
  },
]

/**
 * Componente de Breadcrumbs. Muestra la ruta de navegación actual como una
 * lista ordenada de enlaces. Utiliza el estilo `breadcrumbs` de DaisyUI
 * para un diseño limpio. Para la última entrada de la lista, si no se
 * proporciona `href`, se renderiza como texto plano.
 */
export default function Breadcrumbs({ items }: { items: BreadcrumbItem[] }) {
  const { data: session } = useSession()
  const pathname = usePathname()
  const [pendingHref, setPendingHref] = useState<string | null>(null)
  const activeRole = session?.user?.activeRole

  useEffect(() => {
    setPendingHref(null)
  }, [pathname])

  if (!items || items.length === 0) return null

  const visibleSectionItems = sectionMenuItems.filter((menuItem) =>
    activeRole ? menuItem.allowedRoles.includes(activeRole) : true
  )

  return (
    <div className="breadcrumbs relative overflow-visible text-sm sm:mb-2">
      <ul>
        {items.map((item, index) => {
          const activeMenuItem = sectionMenuItems.find((menuItem) =>
            item.href ? menuItem.href === item.href : menuItem.label === item.label
          )

          if (index === 1) {
            return (
              <li key={`${item.label}-${index}`}>
                <div className="dropdown dropdown-bottom relative z-[95]">
                  <div
                    tabIndex={0}
                    role="button"
                    className="btn btn-ghost btn-xs h-auto min-h-0 gap-1 px-1 py-0.5 text-sm font-normal normal-case"
                  >
                    {pendingHref ? (
                      <ArrowPathIcon className="size-5 shrink-0 animate-spin" />
                    ) : activeMenuItem ? (
                      <span className="shrink-0">{activeMenuItem.icon}</span>
                    ) : null}
                    {activeMenuItem?.label ?? item.label}
                  </div>
                  <ul
                    tabIndex={0}
                    className="dropdown-content menu z-[140] mt-1 w-56 rounded-box border border-base-300 bg-base-100 p-2 shadow-lg"
                  >
                    {visibleSectionItems.map((menuItem) => {
                      const active = activeMenuItem?.key === menuItem.key

                      return (
                        <li key={menuItem.key}>
                          <Link
                            href={menuItem.href}
                            onClick={() => {
                              if (!active) setPendingHref(menuItem.href)
                            }}
                            className={active ? "active font-semibold" : undefined}
                          >
                            {pendingHref === menuItem.href ? (
                              <ArrowPathIcon className="size-5 shrink-0 animate-spin" />
                            ) : (
                              menuItem.icon
                            )}
                            <span>{menuItem.label}</span>
                          </Link>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              </li>
            )
          }

          return (
            <li key={`${item.label}-${index}`}>
              {item.href ? (
                <Link
                  href={item.href}
                  onClick={() => {
                    if (item.href !== pathname) setPendingHref(item.href ?? null)
                  }}
                >
                  {pendingHref === item.href ? (
                    <span className="inline-flex items-center gap-1">
                      <ArrowPathIcon className="size-4 animate-spin" />
                      {item.label}
                    </span>
                  ) : (
                    item.label
                  )}
                </Link>
              ) : (
                <span>{item.label}</span>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
