"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import type { CSSProperties, ReactNode } from "react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useSession } from "next-auth/react"
import Navbar from "./Navbar"
import UserSessionMenu from "./UserSessionMenu"
import BranchContextSwitcher from "@/components/branches/BranchContextSwitcher"
import {
  dashboardNavigationGroups,
  isDashboardNavigationItemActive,
} from "@/lib/navigation/dashboard-navigation"
import {
  MapPinIcon,
  Bars3BottomLeftIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronDownIcon,
} from "@heroicons/react/24/outline"

const MAGNET_ACTIVATION_WIDTH = 96
const VIEWPORT_SAFE_MARGIN = 16
const FLOATING_SIDEBAR_MARGIN = 8
const FOLLOW_STRENGTH = 0.18
const MAGNET_RETURN_DELAY = 650

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

export default function DashboardLayout({
  children,
}: {
  children?: ReactNode
}) {
  const pathname = usePathname()
  const router = useRouter()
  const { data: session } = useSession()

  const activeRole = session?.user?.activeRole

  const [collapsed, setCollapsed] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sidebarPinned, setSidebarPinned] = useState(false)
  const [isDesktopNavigation, setIsDesktopNavigation] = useState(false)
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({})

  const handleRef = useRef<HTMLButtonElement>(null)
  const sidebarRef = useRef<HTMLElement>(null)
  const currentYRef = useRef(0)
  const targetYRef = useRef(0)
  const animationFrameRef = useRef<number | null>(null)
  const returnTimeoutRef = useRef<number | null>(null)
  const sidebarOpenRef = useRef(false)
  const sidebarPinnedRef = useRef(false)

  const isTabActive = useCallback(
    (href: string) => isDashboardNavigationItemActive(pathname, href),
    [pathname]
  )

  const visibleGroups = useMemo(() => {
    return dashboardNavigationGroups
      .map((group) => ({
        ...group,
        items: group.items.filter((item) => {
          if (!activeRole) return true
          return item.allowedRoles.includes(activeRole)
        }),
      }))
      .filter((group) => group.items.length > 0)
  }, [activeRole])

  const activeGroupKey = useMemo(() => {
    return visibleGroups.find((group) =>
      group.items.some((item) => isTabActive(item.href))
    )?.key
  }, [isTabActive, visibleGroups])

  useEffect(() => {
    const savedCollapsed = window.localStorage.getItem(
      "dashboard-sidebar-collapsed"
    )

    if (savedCollapsed !== null) {
      setCollapsed(savedCollapsed === "true")
    }

    const savedOpenGroups = window.localStorage.getItem(
      "dashboard-sidebar-open-groups"
    )

    if (savedOpenGroups) {
      try {
        setOpenGroups(JSON.parse(savedOpenGroups))
      } catch {
        setOpenGroups({})
      }
    }

    const savedPinned = window.localStorage.getItem(
      "dashboard-sidebar-pinned"
    )
    const desktopNavigation = window.matchMedia("(min-width: 1024px)").matches

    if (savedPinned !== null && desktopNavigation) {
      setSidebarPinned(savedPinned === "true")
    }
  }, [])

  useEffect(() => {
    const desktopQuery = window.matchMedia("(min-width: 1024px)")

    const syncNavigationMode = () => {
      const desktopNavigation = desktopQuery.matches
      setIsDesktopNavigation(desktopNavigation)

      if (!desktopNavigation) {
        setSidebarPinned(false)
        return
      }

      const savedPinned = window.localStorage.getItem(
        "dashboard-sidebar-pinned"
      )

      if (savedPinned === "true") {
        setSidebarPinned(true)
        setSidebarOpen(false)
      }
    }

    syncNavigationMode()
    desktopQuery.addEventListener("change", syncNavigationMode)

    return () => {
      desktopQuery.removeEventListener("change", syncNavigationMode)
    }
  }, [])

  useEffect(() => {
    if (!activeGroupKey) return

    setOpenGroups((prev) => {
      if (prev[activeGroupKey]) return prev

      const next = {
        ...prev,
        [activeGroupKey]: true,
      }

      window.localStorage.setItem(
        "dashboard-sidebar-open-groups",
        JSON.stringify(next)
      )

      return next
    })
  }, [activeGroupKey])

  useEffect(() => {
    sidebarOpenRef.current = sidebarOpen
  }, [sidebarOpen])

  useEffect(() => {
    sidebarPinnedRef.current = sidebarPinned
  }, [sidebarPinned])

  const applyFloatingSidebarTop = useCallback(() => {
    const sidebar = sidebarRef.current
    if (!sidebar || sidebarPinnedRef.current) return

    const desktopNavigation = window.matchMedia("(min-width: 1024px)").matches

    if (!desktopNavigation) {
      sidebar.style.top = `${FLOATING_SIDEBAR_MARGIN}px`
      return
    }

    const rect = sidebar.getBoundingClientRect()
    const sidebarHeight = Math.min(
      rect.height || window.innerHeight - FLOATING_SIDEBAR_MARGIN * 2,
      window.innerHeight - FLOATING_SIDEBAR_MARGIN * 2
    )
    const maxTop = Math.max(
      FLOATING_SIDEBAR_MARGIN,
      window.innerHeight - sidebarHeight - FLOATING_SIDEBAR_MARGIN
    )
    const nextTop = clamp(
      currentYRef.current - sidebarHeight / 2,
      FLOATING_SIDEBAR_MARGIN,
      maxTop
    )

    sidebar.style.top = `${nextTop}px`
  }, [])

  const openFloatingSidebar = useCallback(() => {
    setSidebarOpen(true)

    window.requestAnimationFrame(() => {
      applyFloatingSidebarTop()
    })
  }, [applyFloatingSidebarTop])

  const closeSidebar = useCallback(() => {
    setSidebarOpen(false)
  }, [])

  const handleNavigation = useCallback(() => {
    if (!sidebarPinnedRef.current) {
      setSidebarOpen(false)
    }
  }, [])

  const toggleSidebarPinned = () => {
    const next = !sidebarPinned

    setSidebarPinned(next)
    setSidebarOpen(!next)
    window.localStorage.setItem("dashboard-sidebar-pinned", String(next))

    if (!next) {
      window.requestAnimationFrame(() => {
        applyFloatingSidebarTop()
      })
    }
  }

  const toggleDesktopCollapse = () => {
    setCollapsed((prev) => {
      const next = !prev
      window.localStorage.setItem("dashboard-sidebar-collapsed", String(next))
      return next
    })
  }

  const toggleGroup = (groupKey: string) => {
    setOpenGroups((prev) => {
      const next = {
        ...prev,
        [groupKey]: !prev[groupKey],
      }

      window.localStorage.setItem(
        "dashboard-sidebar-open-groups",
        JSON.stringify(next)
      )

      return next
    })
  }

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.key === "Escape" &&
        sidebarOpenRef.current &&
        !sidebarPinnedRef.current
      ) {
        setSidebarOpen(false)
      }
    }

    window.addEventListener("keydown", handleKeyDown)

    return () => {
      window.removeEventListener("keydown", handleKeyDown)
    }
  }, [])

  useEffect(() => {
    if (!sidebarOpen || sidebarPinned) return

    const frame = window.requestAnimationFrame(() => {
      applyFloatingSidebarTop()
    })

    return () => {
      window.cancelAnimationFrame(frame)
    }
  }, [
    applyFloatingSidebarTop,
    collapsed,
    openGroups,
    sidebarOpen,
    sidebarPinned,
    visibleGroups,
  ])

  useEffect(() => {
    if (sidebarPinned) return

    const desktopQuery = window.matchMedia("(min-width: 1024px)")
    const finePointerQuery = window.matchMedia("(pointer: fine)")
    const reducedMotionQuery = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    )

    const supportsMagneticNavigation = () =>
      desktopQuery.matches && finePointerQuery.matches

    const getHandleHeight = () =>
      handleRef.current?.getBoundingClientRect().height || 48

    const getSafeCenterY = (centerY: number) => {
      const halfHandleHeight = getHandleHeight() / 2

      return clamp(
        centerY,
        VIEWPORT_SAFE_MARGIN + halfHandleHeight,
        window.innerHeight - VIEWPORT_SAFE_MARGIN - halfHandleHeight
      )
    }

    const getNeutralCenterY = () => getSafeCenterY(window.innerHeight * 0.45)

    const writeHandlePosition = (centerY: number) => {
      const handle = handleRef.current
      if (!handle) return

      const handleHeight = getHandleHeight()
      const top = clamp(
        centerY - handleHeight / 2,
        VIEWPORT_SAFE_MARGIN,
        window.innerHeight - handleHeight - VIEWPORT_SAFE_MARGIN
      )

      handle.style.top = `${top}px`
    }

    const stopAnimation = () => {
      if (animationFrameRef.current === null) return

      window.cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = null
    }

    const tick = () => {
      const distance = targetYRef.current - currentYRef.current
      const nextY = currentYRef.current + distance * FOLLOW_STRENGTH

      currentYRef.current =
        Math.abs(distance) < 0.5 ? targetYRef.current : nextY

      writeHandlePosition(currentYRef.current)

      if (sidebarOpenRef.current && !sidebarPinnedRef.current) {
        applyFloatingSidebarTop()
      }

      if (Math.abs(targetYRef.current - currentYRef.current) >= 0.5) {
        animationFrameRef.current = window.requestAnimationFrame(tick)
      } else {
        animationFrameRef.current = null
      }
    }

    const startAnimation = () => {
      if (animationFrameRef.current !== null) return

      animationFrameRef.current = window.requestAnimationFrame(tick)
    }

    const moveHandle = (centerY: number) => {
      targetYRef.current = getSafeCenterY(centerY)

      if (reducedMotionQuery.matches) {
        stopAnimation()
        currentYRef.current = targetYRef.current
        writeHandlePosition(currentYRef.current)
        applyFloatingSidebarTop()
        return
      }

      startAnimation()
    }

    const scheduleNeutralReturn = () => {
      if (returnTimeoutRef.current !== null) return

      returnTimeoutRef.current = window.setTimeout(() => {
        returnTimeoutRef.current = null
        moveHandle(getNeutralCenterY())
      }, MAGNET_RETURN_DELAY)
    }

    const clearNeutralReturn = () => {
      if (returnTimeoutRef.current === null) return

      window.clearTimeout(returnTimeoutRef.current)
      returnTimeoutRef.current = null
    }

    const handlePointerMove = (event: PointerEvent) => {
      if (!supportsMagneticNavigation()) return

      if (event.clientX <= MAGNET_ACTIVATION_WIDTH) {
        clearNeutralReturn()
        moveHandle(event.clientY)
        return
      }

      scheduleNeutralReturn()
    }

    const syncInitialPosition = () => {
      const neutralCenterY = getNeutralCenterY()

      currentYRef.current = neutralCenterY
      targetYRef.current = neutralCenterY
      writeHandlePosition(neutralCenterY)
      applyFloatingSidebarTop()
    }

    syncInitialPosition()

    window.addEventListener("pointermove", handlePointerMove, {
      passive: true,
    })
    window.addEventListener("resize", syncInitialPosition)
    desktopQuery.addEventListener("change", syncInitialPosition)
    finePointerQuery.addEventListener("change", syncInitialPosition)
    reducedMotionQuery.addEventListener("change", syncInitialPosition)

    return () => {
      clearNeutralReturn()
      stopAnimation()
      window.removeEventListener("pointermove", handlePointerMove)
      window.removeEventListener("resize", syncInitialPosition)
      desktopQuery.removeEventListener("change", syncInitialPosition)
      finePointerQuery.removeEventListener("change", syncInitialPosition)
      reducedMotionQuery.removeEventListener("change", syncInitialPosition)
    }
  }, [applyFloatingSidebarTop, sidebarPinned])

  const effectiveCollapsed = isDesktopNavigation && collapsed
  const sidebarVisible = sidebarPinned || sidebarOpen
  const showBackdrop = sidebarOpen && !sidebarPinned
  const sidebarWidth = effectiveCollapsed
    ? "lg:w-[68px] w-[240px]"
    : "w-[240px]"
  const contentOffset = sidebarPinned
    ? effectiveCollapsed
      ? "lg:pl-[84px]"
      : "lg:pl-[256px]"
    : ""

  const renderLogo = (expanded: boolean) => (
    <div className="flex items-center">
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
          expanded ? "ml-2 max-w-[150px] opacity-100" : "max-w-0 opacity-0",
        ].join(" ")}
      >
        Importaciones
      </span>
    </div>
  )

  return (
    <div className="min-h-screen bg-base-100">
      <button
        ref={handleRef}
        type="button"
        aria-label="Abrir menú lateral"
        title="Abrir menú lateral"
        onClick={openFloatingSidebar}
        className={[
          "fixed -left-[1.35rem] top-[45vh] z-[180] hidden h-12 w-12 items-center justify-center rounded-r-xl border border-base-300 bg-base-200/90 text-base-content shadow backdrop-blur transition-[left,transform,opacity,box-shadow,background-color] duration-200 ease-out hover:left-2 hover:scale-[1.03] hover:bg-base-200/95 hover:shadow-lg focus-visible:left-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary motion-reduce:transform-none motion-reduce:transition-none motion-reduce:hover:scale-100 lg:inline-flex",
          sidebarPinned
            ? "pointer-events-none opacity-0"
            : "pointer-events-auto opacity-100",
        ].join(" ")}
      >
        <Bars3BottomLeftIcon className="size-6" />
      </button>

      <button
        type="button"
        aria-label="Abrir menú lateral"
        title="Abrir menú lateral"
        onClick={openFloatingSidebar}
        className={[
          "btn btn-sm btn-square fixed left-2 top-3 z-[180] border border-base-300 bg-base-200/95 shadow-lg backdrop-blur transition-opacity duration-200 lg:hidden",
          sidebarVisible
            ? "pointer-events-none opacity-0"
            : "pointer-events-auto opacity-100",
        ].join(" ")}
      >
        <Bars3BottomLeftIcon className="size-6" />
      </button>

      <button
        type="button"
        aria-label="Cerrar menú lateral"
        onClick={closeSidebar}
        className={[
          "fixed inset-0 z-[150] bg-black/20 backdrop-blur-[1px] transition-opacity duration-300",
          showBackdrop
            ? "pointer-events-auto opacity-100"
            : "pointer-events-none opacity-0",
        ].join(" ")}
      />

      <aside
        ref={sidebarRef}
        style={
          sidebarPinned
            ? ({
              top: FLOATING_SIDEBAR_MARGIN,
              bottom: FLOATING_SIDEBAR_MARGIN,
            } as CSSProperties)
            : ({ top: FLOATING_SIDEBAR_MARGIN } as CSSProperties)
        }
        className={[
          "fixed left-2 z-[190] flex max-h-[calc(100vh-16px)] flex-col overflow-visible rounded-xl bg-base-200/95 backdrop-blur transition-[width,transform,top,box-shadow,border-color] duration-300 ease-out motion-reduce:transition-none",
          sidebarPinned
            ? "border border-base-300 shadow-none"
            : "border border-transparent shadow-2xl",
          sidebarPinned ? "bottom-2" : "bottom-2 lg:bottom-auto",
          sidebarWidth,
          sidebarVisible ? "translate-x-0" : "-translate-x-[120%]",
        ].join(" ")}
      >
        <div
          className={[
            "px-2 py-2",
            effectiveCollapsed
              ? "flex flex-col items-center gap-2"
              : "flex items-center gap-2",
          ].join(" ")}
        >
          <div
            className={[
              "flex h-11 min-w-0 items-center",
              effectiveCollapsed ? "justify-center" : "flex-1 px-2",
            ].join(" ")}
          >
            {renderLogo(!effectiveCollapsed)}
          </div>

          <div
            className={[
              "flex gap-1",
              effectiveCollapsed ? "flex-col" : "items-center",
            ].join(" ")}
          >
            <button
              type="button"
              onClick={toggleSidebarPinned}
              className="btn btn-ghost btn-sm btn-square hidden lg:inline-flex"
              aria-label={sidebarPinned ? "Desfijar menú" : "Fijar menú"}
              title={sidebarPinned ? "Desfijar menú" : "Fijar menú"}
            >
              <MapPinIcon
                className={[
                  "size-5 transition-transform duration-200",
                  sidebarPinned ? "text-primary" : "",
                ].join(" ")}
              />
            </button>

            <button
              type="button"
              onClick={toggleDesktopCollapse}
              className="btn btn-ghost btn-sm btn-square hidden lg:inline-flex"
              aria-label={
                effectiveCollapsed
                  ? "Expandir menú lateral"
                  : "Colapsar menú lateral"
              }
              title={effectiveCollapsed ? "Expandir menú" : "Colapsar menú"}
            >
              {effectiveCollapsed ? (
                <ChevronRightIcon className="size-5" />
              ) : (
                <ChevronLeftIcon className="size-5" />
              )}
            </button>
          </div>
        </div>

        <nav className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
          <div className="space-y-3">
            {visibleGroups.map((group, groupIndex) => {
              const groupHasActiveItem = group.items.some((item) =>
                isTabActive(item.href)
              )

              const groupIsOpen =
                effectiveCollapsed ||
                groupHasActiveItem ||
                openGroups[group.key] !== false

              return (
                <section
                  key={group.key}
                  className={groupIndex > 0 && effectiveCollapsed ? "border-t border-base-300 pt-3" : ""}
                >
                  {!effectiveCollapsed && group.label ? (
                    <button
                      type="button"
                      onClick={() => toggleGroup(group.key)}
                      className="flex w-full items-center justify-between rounded-md px-2 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-base-content/45 transition hover:bg-base-300/50 hover:text-base-content/70"
                      aria-expanded={groupIsOpen}
                    >
                      <span>{group.label}</span>

                      <ChevronDownIcon
                        className={[
                          "size-3.5 transition-transform duration-200",
                          groupIsOpen ? "rotate-0" : "-rotate-90",
                        ].join(" ")}
                      />
                    </button>
                  ) : null}

                  {groupIsOpen ? (
                    <ul
                      className={[
                        "menu gap-1 p-0",
                        !effectiveCollapsed && group.label ? "mt-1" : "",
                      ].join(" ")}
                    >
                      {group.items.map((item) => {
                        const active = isTabActive(item.href)
                        const Icon = item.icon

                        const baseClasses = [
                          "group relative flex items-center rounded-lg transition-all duration-200",
                          effectiveCollapsed ? "h-10 justify-center px-0" : "h-10 gap-3 px-3",
                        ].join(" ")

                        const stateClasses = active
                          ? "bg-primary/10 text-primary font-semibold"
                          : "text-base-content/70 hover:bg-base-300/70 hover:text-base-content"

                        return (
                          <li key={item.key}>
                            <Link
                              href={item.href}
                              onClick={handleNavigation}
                              onMouseEnter={() => router.prefetch(item.href)}
                              title={effectiveCollapsed ? item.label : undefined}
                              aria-current={active ? "page" : undefined}
                              className={[baseClasses, stateClasses].join(" ")}
                            >
                              {active ? (
                                <span
                                  aria-hidden="true"
                                  className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-primary"
                                />
                              ) : null}

                              <Icon
                                className={[
                                  "size-5 shrink-0 transition-transform duration-200",
                                  active
                                    ? "text-primary"
                                    : "text-base-content/55 group-hover:text-base-content",
                                  !effectiveCollapsed ? "group-hover:scale-105" : "",
                                ].join(" ")}
                              />

                              <span
                                className={[
                                  "overflow-hidden whitespace-nowrap text-sm transition-all duration-300",
                                  effectiveCollapsed
                                    ? "hidden max-w-0 opacity-0"
                                    : "max-w-[170px] opacity-100",
                                ].join(" ")}
                              >
                                {item.label}
                              </span>
                            </Link>
                          </li>
                        )
                      })}
                    </ul>
                  ) : null}
                </section>
              )
            })}
          </div>
        </nav>

        <div className="relative z-10 space-y-2 border-t border-base-300 px-2 py-2">
          {!effectiveCollapsed ? <BranchContextSwitcher /> : null}
          {/* <UserSessionMenu menu="side" /> */}
          {/* Box height */}
          <div className="h-10" />
        </div>
      </aside>

      <div
        className={[
          "min-h-screen transition-[padding] duration-300 ease-out motion-reduce:transition-none",
          contentOffset,
        ].join(" ")}
      >
        <Navbar />

        <main className="px-3 pb-3 sm:px-4 sm:pb-4">
          <div className="min-h-[calc(100vh-96px)] bg-base-100">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
