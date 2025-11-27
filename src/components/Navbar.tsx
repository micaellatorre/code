"use client"

import { useEffect, useState } from 'react'
import { useDolar } from "@/app/hooks/useDolar"
import { DolarPanelItem } from "@/app/lib/dolar"
import { Bars3Icon, ArrowTopRightOnSquareIcon, ChevronDownIcon, SunIcon, MoonIcon } from '@heroicons/react/24/solid'

export default function Navbar({
  onToggleSidebar,
}: {
  onToggleSidebar: () => void
}) {
  const themes = [
    { value: 'luxury', label: 'Luxury', type: 'dark' },
    { value: 'halloween', label: 'Halloween', type: 'dark' },
    { value: 'forest', label: 'Forest', type: 'dark' },
    { value: 'black', label: 'Black', type: 'dark' },
    { value: 'night', label: 'Night', type: 'dark' },
    { value: 'coffee', label: 'Coffee', type: 'dark' },
    { value: 'retro', label: 'Desert', type: 'light' },
    { value: 'fantasy', label: 'Fantasy', type: 'light' },
    { value: 'wireframe', label: 'Wireframe', type: 'light' },
    { value: 'cmyk', label: 'CMYK', type: 'light' },
    { value: 'autumn', label: 'Autumn', type: 'light' },
    { value: 'lemonade', label: 'Lemonade', type: 'light' },
    { value: 'winter', label: 'Winter', type: 'light' },
  ]
  const [theme, setTheme] = useState('light')
  const { data: dolarData, error, isLoading } = useDolar()

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('theme')
      const initial = saved ?? 'light'
      setTheme(initial)
      document.documentElement.setAttribute('data-theme', initial)
    }
  }, [])

  // Process dolar data when it's available
  const dolarBlueVenta = dolarData?.panel?.find((d: DolarPanelItem) => d.titulo === "Dólar Blue")?.venta?.toLocaleString("es-AR", { minimumFractionDigits: 2 }) ?? null;
  const dolarCriptoVenta = dolarData?.panel?.find((d: DolarPanelItem) => d.titulo === "Dólar Cripto")?.venta?.toLocaleString("es-AR", { minimumFractionDigits: 2 }) ?? null;

  // Debug logging
  useEffect(() => {
    if (error) {
      console.error("Error obteniendo cotizaciones del dólar:", error);
    }
  }, [error, dolarData]);

  const handleThemeChange = (value: string) => {
    setTheme(value)
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', value)
      localStorage.setItem('theme', value)
    }
  }

  return (
    <div className="navbar bg-base-100 shadow mb-4">
      <div className="flex-1">
        {/* Botón para alternar el menú lateral */}
        <button
          type="button"
          onClick={onToggleSidebar}
          className="btn btn-ghost normal-case text-xl"
        >
          <Bars3Icon className="size-6" />

        </button>
      </div>
      <div className="flex items-center gap-4 mr-4">
        {/* add link to new tab for https://www.finanzasargy.com */}
        <a className="flex flex-row gap-2 items-center text-blue-500 hover:text-blue-700" href="https://www.finanzasargy.com" target="_blank" rel="noopener noreferrer">
          FinanzasArgy
          <ArrowTopRightOnSquareIcon className="size-4" />
        </a>
        <div className="px-3 py-1 rounded-full bg-base-content/5 text-blue-700 text-sm font-medium border border-blue-400">
          Dólar Blue:{" "}
          <span className="font-semibold text-base-content">
            {isLoading ? "..." : error ? "Error" : dolarBlueVenta ? `$${dolarBlueVenta}` : "—"}
          </span>
          <span className="text-xs text-base-content/60"> vta</span>
        </div>
        <div className="px-3 py-1 rounded-full bg-base-content/5 text-emerald-700 text-sm font-medium border border-emerald-400">
          Dólar Cripto:{" "}
          <span className="font-semibold text-base-content">
            {isLoading ? "..." : error ? "Error" : dolarCriptoVenta ? `$${dolarCriptoVenta}` : "—"}
          </span>
          <span className="text-xs text-base-content/60"> vta</span>
        </div>
      </div>
      <div className="flex-none">
        {/* Menú desplegable para seleccionar el tema */}
        <div className="dropdown dropdown-end">
          <div tabIndex={0} role="button" className="btn m-1">
            Tema
            <ChevronDownIcon className="inline-block h-2 w-2 fill-current opacity-60 ml-1" />
          </div>
          <ul
            tabIndex={0}
            className="dropdown-content z-50 menu p-2 shadow bg-base-200 rounded-box w-48"
          >
            {themes.map((t) => (
              <li key={t.value}>
                <label className="flex items-center justify-between w-full cursor-pointer relative">
                  <input
                    type="radio"
                    name="theme-dropdown"
                    className="theme-controller btn btn-sm btn-ghost justify-start"
                    aria-label={t.label}
                    value={t.value}
                    checked={theme === t.value}
                    onChange={() => handleThemeChange(t.value)}
                  />
                  {t.type === 'light' ? (
                    <SunIcon className="size-5 absolute right-2 pointer-events-none" />
                  ) : (
                    <MoonIcon className="size-4 absolute right-2 pointer-events-none" />
                  )}
                </label>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}
