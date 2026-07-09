"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import type { MouseEvent } from "react"
import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import {
  ArrowPathIcon,
  ChevronDownIcon,
  PlusIcon,
} from "@heroicons/react/24/outline"
import {
  dashboardNavigationGroups,
  findDashboardNavigationItemByPath,
  flattenDashboardNavigation,
} from "@/lib/navigation/dashboard-navigation"

export interface BreadcrumbItem {
  /** Texto visible para este paso en el breadcrumb. */
  label: string

  /**
   * Ruta a la que debe enlazar este paso.
   * Si no se especifica, se interpreta como la página actual.
   */
  href?: string
}

export default function Breadcrumbs({
  items,
}: {
  items: BreadcrumbItem[]
}) {
  const { data: session } = useSession()
  const pathname = usePathname()
  const router = useRouter()

  const dropdownRef = useRef<HTMLDivElement>(null)

  const [pendingHref, setPendingHref] = useState<string | null>(null)
  const [dropdownOpen, setDropdownOpen] = useState(false)

  const activeRole = session?.user?.activeRole

  useEffect(() => {
    setPendingHref(null)
    setDropdownOpen(false)
  }, [pathname])

  const visibleSectionGroups = useMemo(() => {
    return dashboardNavigationGroups
      .map((group) => ({
        ...group,
        items: group.items.filter((menuItem) =>
          activeRole
            ? menuItem.allowedRoles.includes(activeRole)
            : true
        ),
      }))
      .filter((group) => group.items.length > 0)
  }, [activeRole])

  const allVisibleSectionItems = useMemo(
    () => flattenDashboardNavigation(visibleSectionGroups),
    [visibleSectionGroups]
  )

  const activeSectionMenuItem = useMemo(() => {
    return findDashboardNavigationItemByPath(
      pathname,
      allVisibleSectionItems
    )
  }, [allVisibleSectionItems, pathname])

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      const dropdown = dropdownRef.current

      if (
        dropdown &&
        event.target instanceof Node &&
        !dropdown.contains(event.target)
      ) {
        setDropdownOpen(false)
      }
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setDropdownOpen(false)
      }
    }

    window.addEventListener("pointerdown", handlePointerDown)
    window.addEventListener("keydown", handleKeyDown)

    return () => {
      window.removeEventListener("pointerdown", handlePointerDown)
      window.removeEventListener("keydown", handleKeyDown)
    }
  }, [])

  if (!items || items.length === 0) return null

  const findSectionMenuItem = (item: BreadcrumbItem) => {
    const targetPath = item.href ?? pathname

    const itemByPath = findDashboardNavigationItemByPath(
      targetPath,
      allVisibleSectionItems
    )

    if (itemByPath) return itemByPath

    return allVisibleSectionItems.find(
      (menuItem) => menuItem.label === item.label
    )
  }

  const handleSectionNavigation = (
    href: string,
    active: boolean
  ) => {
    if (active) {
      setDropdownOpen(false)
      return
    }

    setPendingHref(href)
    setDropdownOpen(false)
  }

  const handleQuickAddClick = (
    event: MouseEvent<HTMLAnchorElement>,
    href: string
  ) => {
    event.stopPropagation()

    setPendingHref(href)
    setDropdownOpen(false)
  }

  return (
    <nav
      aria-label="Breadcrumb"
      className="relative mb-1 overflow-visible sm:mb-2"
    >
      <div className="breadcrumbs overflow-visible text-sm">
        <ul className="min-w-0">
          {items.map((item, index) => {
            const activeMenuItem =
              index === 1
                ? activeSectionMenuItem ?? findSectionMenuItem(item)
                : findSectionMenuItem(item)

            if (index === 1) {
              const ActiveIcon = activeMenuItem?.icon
              const activePending =
                pendingHref === activeMenuItem?.href

              return (
                <li key={`${item.label}-${index}`}>
                  <div
                    ref={dropdownRef}
                    className="relative z-[95]"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setDropdownOpen((prev) => !prev)
                      }}
                      aria-haspopup="true"
                      aria-expanded={dropdownOpen}
                      className={[
                        "group flex h-8 items-center gap-1.5 rounded-lg px-2",
                        "text-sm font-medium text-base-content/80",
                        "transition-colors duration-200",
                        "hover:bg-base-200 hover:text-base-content",
                        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary",
                        dropdownOpen
                          ? "bg-base-200 text-base-content"
                          : "",
                      ].join(" ")}
                    >
                      {activePending ? (
                        <ArrowPathIcon className="size-4.5 shrink-0 animate-spin text-primary" />
                      ) : ActiveIcon ? (
                        <ActiveIcon className="size-5 text-primary" />
                      ) : null}

                      <span>
                        {activeMenuItem?.label ?? item.label}
                      </span>

                      <ChevronDownIcon
                        className={[
                          "size-3.5 shrink-0 text-base-content/45",
                          "transition-transform duration-200",
                          dropdownOpen ? "rotate-180" : "",
                        ].join(" ")}
                      />
                    </button>

                    <div
                      className={[
                        "absolute left-0 top-full mt-1.5 w-72 origin-top-left",
                        "overflow-hidden rounded-xl border border-base-300",
                        "bg-base-100/95 p-1.5 shadow-xl backdrop-blur",
                        "transition-[opacity,transform] duration-150 ease-out",
                        dropdownOpen
                          ? "pointer-events-auto translate-y-0 scale-100 opacity-100"
                          : "pointer-events-none -translate-y-1 scale-[0.98] opacity-0",
                      ].join(" ")}
                    >
                      <div className="max-h-[min(70vh,32rem)] overflow-y-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                        {visibleSectionGroups.map(
                          (group, groupIndex) => (
                            <section
                              key={group.key}
                              className={
                                groupIndex > 0
                                  ? "mt-1 border-t border-base-200 pt-1"
                                  : ""
                              }
                            >
                              <div className="px-2 pb-1 pt-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-base-content/40">
                                {group.label}
                              </div>

                              <ul className="space-y-0.5">
                                {group.items.map((menuItem) => {
                                  const active =
                                    activeSectionMenuItem?.key === menuItem.key

                                  const menuPending =
                                    pendingHref === menuItem.href

                                  const quickAddPending =
                                    menuItem.quickAddHref
                                      ? pendingHref === menuItem.quickAddHref
                                      : false
                                  const quickAddHref = menuItem.quickAddHref
                                  const isQuickAddActive =
                                    quickAddHref === pathname

                                  const Icon = menuItem.icon

                                  return (
                                    <li key={menuItem.key}>
                                      <div
                                        className={[
                                          "group/menu-item relative flex min-h-10 items-center rounded-lg",
                                          "transition-colors duration-150",
                                          active
                                            ? "bg-primary/10"
                                            : "hover:bg-base-200/80",
                                        ].join(" ")}
                                      >
                                        <Link
                                          href={menuItem.href}
                                          onClick={() =>
                                            handleSectionNavigation(
                                              menuItem.href,
                                              active
                                            )
                                          }
                                          onMouseEnter={() =>
                                            router.prefetch(
                                              menuItem.href
                                            )
                                          }
                                          className={[
                                            "flex min-w-0 flex-1 items-center gap-3 px-3 py-2",
                                            "rounded-lg",
                                            active
                                              ? "font-semibold text-primary"
                                              : "text-base-content/75 group-hover/menu-item:text-base-content",
                                          ].join(" ")}
                                        >
                                          {menuPending ? (
                                            <ArrowPathIcon className="size-5 shrink-0 animate-spin text-primary" />
                                          ) : (
                                            <Icon
                                              className={[
                                                "size-5 shrink-0 transition-colors duration-150",
                                                active
                                                  ? "text-primary"
                                                  : "text-base-content/50 group-hover/menu-item:text-base-content/75",
                                              ].join(" ")}
                                            />
                                          )}

                                          <span className="min-w-0 truncate">
                                            {menuItem.label}
                                          </span>
                                        </Link>

                                        {quickAddHref && !isQuickAddActive ? (
                                          <Link
                                            href={quickAddHref}
                                            onClick={(event) =>
                                              handleQuickAddClick(
                                                event,
                                                quickAddHref
                                              )
                                            }
                                            onMouseEnter={() =>
                                              router.prefetch(
                                                quickAddHref
                                              )
                                            }
                                            aria-label={
                                              menuItem.quickAddLabel ??
                                              `Crear ${menuItem.label}`
                                            }
                                            title={
                                              menuItem.quickAddLabel ??
                                              `Crear ${menuItem.label}`
                                            }
                                            className={[
                                              "mr-1.5 flex size-8 shrink-0 items-center justify-center rounded-md",
                                              "text-base-content/40",
                                              "opacity-0 transition-[background-color,color,opacity,transform] duration-150",
                                              "group-hover/menu-item:opacity-100",
                                              "hover:scale-[1.04] hover:bg-primary/10 hover:text-primary",
                                              "focus-visible:opacity-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary",
                                              "max-lg:opacity-100",
                                              quickAddPending
                                                ? "bg-primary/10 text-primary opacity-100"
                                                : "",
                                            ].join(" ")}
                                          >
                                            {quickAddPending ? (
                                              <ArrowPathIcon className="size-4.5 animate-spin" />
                                            ) : (
                                              <PlusIcon className="size-4.5" />
                                            )}
                                          </Link>
                                        ) : null}

                                        {active ? (
                                          <span
                                            aria-hidden="true"
                                            className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-primary"
                                          />
                                        ) : null}
                                      </div>
                                    </li>
                                  )
                                })}
                              </ul>
                            </section>
                          )
                        )}
                      </div>
                    </div>
                  </div>
                </li>
              )
            }

            return (
              <li key={`${item.label}-${index}`}>
                {item.href ? (
                  <Link
                    href={item.href}
                    onMouseEnter={() => router.prefetch(item.href!)}
                    onClick={() => {
                      if (item.href !== pathname) {
                        setPendingHref(item.href ?? null)
                      }
                    }}
                    className="transition-colors hover:text-primary"
                  >
                    {pendingHref === item.href ? (
                      <span className="inline-flex items-center gap-1.5">
                        <ArrowPathIcon className="size-4 animate-spin text-primary" />
                        {item.label}
                      </span>
                    ) : (
                      item.label
                    )}
                  </Link>
                ) : (
                  <span className="font-medium text-base-content">
                    {item.label}
                  </span>
                )}
              </li>
            )
          })}
        </ul>
      </div>
    </nav>
  )
}
