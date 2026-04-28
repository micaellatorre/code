"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import type { ReactNode } from "react"
import { useMemo, useState } from "react"
import { useSession } from "next-auth/react"
import Navbar from "./Navbar"
import UserSessionMenu from "./UserSessionMenu"
import type { Role } from "@/lib/auth/roles"
import {
  CalendarIcon,
  DevicePhoneMobileIcon,
  CurrencyDollarIcon,
  Squares2X2Icon,
  UsersIcon,
} from "@heroicons/react/24/solid"

export default function DashboardLayout({
  children,
}: {
  children?: ReactNode
}) {
  const pathname = usePathname()
  const { data: session } = useSession()

  const tabs = useMemo(
    () => [
      {
        key: "dashboard",
        label: "Dashboard",
        href: "/dashboard",
        icon: <Squares2X2Icon className="size-5 shrink-0" />,
        allowedRoles: ["ADMIN", "SOCIO"] as Role[],
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
    ],
    []
  )

  const [collapsed, setCollapsed] = useState(true)
  const [mobileOpen, setMobileOpen] = useState(false)

  const toggleSidebarVisibility = () => {
    setMobileOpen((prev) => !prev)
  }

  const closeSidebar = () => {
    setMobileOpen(false)
  }

  const toggleDesktopCollapse = () => {
    setCollapsed((prev) => !prev)
  }

  const isTabActive = (href: string) => {
    if (href === "/") return pathname === "/"
    return pathname === href || pathname.startsWith(`${href}/`)
  }

  const activeRole = session?.user?.activeRole

  const sidebarWidth = collapsed ? "w-[68px]" : "w-[188px]"

  const renderLogo = (expanded: boolean) => (
    <div className="flex items-center ">
      <svg
        width="40"
        height="20"
        viewBox="0 0 60 30"
        className="fill-primary shrink-0"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path d="M52.9051 0.169864C53.5247 0.174083 54.0903 0.524401 54.3719 1.07831L59.8256 11.8074C60.1293 12.4048 60.0462 13.1268 59.6149 13.6391L56.467 17.3776C55.0132 19.1042 52.8737 20.0982 50.6214 20.0935L39.8412 20.0709C38.8558 20.0688 37.9204 20.5064 37.2883 21.2651L34.1525 25.0293C34.1159 25.0732 34.0685 25.107 34.0151 25.1272L21.8445 29.7364C21.5245 29.8576 21.2532 29.4726 21.4736 29.2102L34.3083 13.9316C34.9377 13.1824 35.864 12.7494 36.8404 12.7479L51.1152 12.7261C52.0995 12.7246 53.0324 12.2846 53.6618 11.525L56.2871 8.35633C56.556 8.03167 56.3273 7.53927 55.9066 7.53733L40.4565 7.46611C40.1747 7.46482 40.0227 7.1339 40.2047 6.91797L45.4301 0.717513C45.7479 0.340395 46.2161 0.124323 46.7082 0.127674L52.9051 0.169864Z" />
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M33.3287 6.86922C33.0124 7.24555 32.5464 7.46212 32.0559 7.46077L13.5574 7.40976C12.6004 7.40712 11.6889 7.81922 11.0568 8.5403L3.69258 16.9407C3.41008 17.263 3.63725 17.7691 4.06492 17.7703L14.5701 17.7991C14.8644 17.7999 15.144 17.67 15.3338 17.4442L16.3762 16.2039C16.5582 15.9873 16.4048 15.6561 16.1225 15.6561L13.5029 15.6561C13.3899 15.6561 13.3286 15.5235 13.4015 15.4369L15.0543 13.4728C15.4331 13.0226 15.9906 12.7632 16.5777 12.7638L27.8692 12.7767C28.0667 12.777 28.1738 13.0088 28.0464 13.1602L18.5167 24.4932C18.2015 24.8682 17.7375 25.0845 17.2487 25.0845L7.68044 25.0846C7.0561 25.0846 6.48462 24.7328 6.20155 24.1743L0.189758 12.3128C-0.107083 11.7272 -0.0330145 11.021 0.378841 10.5102L4.82242 4.99902C7.35071 1.86327 11.1584 0.0460556 15.1776 0.0570848L38.2877 0.120503C38.5696 0.121277 38.7222 0.452076 38.5405 0.668309L33.3287 6.86922Z"
        />
      </svg>

      <span
        className={[
          "overflow-hidden whitespace-nowrap text-sm font-semibold transition-all duration-300",
          expanded ? "max-w-[100px] opacity-100 ml-2" : "max-w-0 opacity-0",
        ].join(" ")}
      >
        Importaciones
      </span>
    </div>
  )

  return (
    <div className="min-h-screen bg-base-100">
      <button
        type="button"
        aria-label="Cerrar menú lateral"
        onClick={closeSidebar}
        className={[
          "fixed inset-0 z-[150] bg-black/30 transition-opacity duration-300",
          mobileOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none",
        ].join(" ")}
      />

      <aside
        className={[
          "fixed inset-y-0 left-0 z-[190] m-2 flex flex-col rounded-xl bg-base-200/95 backdrop-blur shadow-2xl transition-all duration-300",
          sidebarWidth,
          mobileOpen ? "translate-x-0" : "-translate-x-[120%]",
        ].join(" ")}
      >
        <div className={`${collapsed ? "px-2" : "px-2"} py-2 flex items-center justify-center`}>
          <button
            type="button"
            onClick={toggleDesktopCollapse}
            className={[
              "btn btn-ghost h-11 min-h-11 rounded-lg transition-all duration-300 px-2",
              collapsed ? "w-auto" : "w-full justify-start",
            ].join(" ")}
            aria-label={collapsed ? "Expandir menú lateral" : "Colapsar menú lateral"}
            title={collapsed ? "Expandir menú" : "Colapsar menú"}
          >
            {renderLogo(!collapsed)}
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-2 pb-2">
          <ul className="menu gap-1 p-0 mt-1">
            {tabs.map((tab) => {
              const active = isTabActive(tab.href)
              const disabled = activeRole ? !tab.allowedRoles.includes(activeRole) : false
              const baseClasses = [
                "group flex items-center rounded-lg transition-all duration-200",
                collapsed ? "justify-center h-10 px-0" : "gap-4 h-10 px-2",
              ].join(" ")
              const stateClasses = disabled
                ? "cursor-not-allowed text-base-content/35 bg-transparent"
                : active
                  ? "bg-primary text-primary-content"
                  : "text-base-content hover:bg-base-300/70"

              return (
                <li key={tab.key}>
                  {disabled ? (
                    <span
                      aria-disabled="true"
                      title={collapsed ? `${tab.label} (sin acceso)` : undefined}
                      className={[baseClasses, stateClasses].join(" ")}
                    >
                      <span className="shrink-0">{tab.icon}</span>
                      <span
                        className={[
                          "overflow-hidden whitespace-nowrap text-sm font-medium transition-all duration-300",
                          collapsed ? "max-w-0 opacity-0 hidden" : "max-w-[100px] opacity-100",
                        ].join(" ")}
                      >
                        {tab.label}
                      </span>
                    </span>
                  ) : (
                    <Link
                      href={tab.href}
                      onClick={closeSidebar}
                      title={collapsed ? tab.label : undefined}
                      className={[baseClasses, stateClasses].join(" ")}
                    >
                      <span className="shrink-0">{tab.icon}</span>
                      <span
                        className={[
                          "overflow-hidden whitespace-nowrap text-sm font-medium transition-all duration-300",
                          collapsed ? "max-w-0 opacity-0 hidden " : "max-w-[100px] opacity-100",
                        ].join(" ")}
                      >
                        {tab.label}
                      </span>
                    </Link>
                  )}
                </li>
              )
            })}
          </ul>
        </nav>
        <div className="border-t border-base-300 px-2 py-2">
          <UserSessionMenu menu="side" />
        </div>
      </aside>

      <div className="min-h-screen">
        <Navbar onToggleSidebar={toggleSidebarVisibility} />

        <main className="px-3 pb-3 sm:px-4 sm:pb-4">
          <div className="min-h-[calc(100vh-96px)] bg-base-100">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
