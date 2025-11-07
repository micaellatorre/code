"use client"

import { useEffect, useState } from 'react'
import { useDolar } from "@/app/hooks/useDolar"
import { DolarPanelItem } from "@/app/lib/dolar"

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
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="size-6">
            <path strokeLinecap="round" strok-linejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
          </svg>

        </button>
      </div>
      <div className="flex items-center gap-4 mr-4">
        {/* add link to new tab for https://www.finanzasargy.com */}
        <a className="flex flex-row gap-2 items-center text-blue-500 hover:text-blue-700" href="https://www.finanzasargy.com" target="_blank" rel="noopener noreferrer">
          FinanzasArgy
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="size-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
          </svg>
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
            <svg
              width="12px"
              height="12px"
              className="inline-block h-2 w-2 fill-current opacity-60 ml-1"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 2048 2048"
            >
              <path d="M1799 349l242 241-1017 1017L7 590l242-241 775 775 775-775z" />
            </svg>
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
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="size-5 absolute right-2 pointer-events-none">
                      <path d="M12 2.25a.75.75 0 0 1 .75.75v2.25a.75.75 0 0 1-1.5 0V3a.75.75 0 0 1 .75-.75ZM7.5 12a4.5 4.5 0 1 1 9 0 4.5 4.5 0 0 1-9 0ZM18.894 6.166a.75.75 0 0 0-1.06-1.06l-1.591 1.59a.75.75 0 1 0 1.06 1.061l1.591-1.59ZM21.75 12a.75.75 0 0 1-.75.75h-2.25a.75.75 0 0 1 0-1.5H21a.75.75 0 0 1 .75.75ZM17.834 18.894a.75.75 0 0 0 1.06-1.06l-1.59-1.591a.75.75 0 1 0-1.061 1.06l1.59 1.591ZM12 18a.75.75 0 0 1 .75.75V21a.75.75 0 0 1-1.5 0v-2.25A.75.75 0 0 1 12 18ZM7.758 17.303a.75.75 0 0 0-1.061-1.06l-1.591 1.59a.75.75 0 0 0 1.06 1.061l1.591-1.59ZM6 12a.75.75 0 0 1-.75.75H3a.75.75 0 0 1 0-1.5h2.25A.75.75 0 0 1 6 12ZM6.697 7.757a.75.75 0 0 0 1.06-1.06l-1.59-1.591a.75.75 0 0 0-1.061 1.06l1.59 1.591Z" />
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="size-4 absolute right-2 pointer-events-none">
                      <path fillRule="evenodd" d="M9.528 1.718a.75.75 0 0 1 .162.819A8.97 8.97 0 0 0 9 6a9 9 0 0 0 9 9 8.97 8.97 0 0 0 3.463-.69.75.75 0 0 1 .981.98 10.503 10.503 0 0 1-9.694 6.46c-5.799 0-10.5-4.7-10.5-10.5 0-4.368 2.667-8.112 6.46-9.694a.75.75 0 0 1 .818.162Z" clipRule="evenodd" />
                    </svg>
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
