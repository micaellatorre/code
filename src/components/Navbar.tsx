"use client"

import { useEffect, useState } from 'react'

/**
 * Componente de barra de navegación superior.
 * Utiliza DaisyUI para el estilo de `navbar` y un menú desplegable
 * para seleccionar el tema. También acepta una función `onToggleSidebar`
 * que se invoca al hacer clic en el botón "Menú" para colapsar o expandir
 * la barra lateral.
 */
export default function Navbar({
  onToggleSidebar,
}: {
  onToggleSidebar: () => void
}) {
  // Lista de temas disponibles. Puedes añadir más temas compatibles con DaisyUI.
  const themes = [
    { value: 'cupcake', label: 'Claro' },
    { value: 'retro', label: 'Desert' },
    { value: 'black', label: 'Oscuro' },
    { value: 'forest', label: 'Forest' },
  ]
  const [theme, setTheme] = useState('light')

  // Al montar, lee el tema guardado en localStorage y lo aplica.
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('theme')
      const initial = saved ?? 'light'
      setTheme(initial)
      document.documentElement.setAttribute('data-theme', initial)
    }
  }, [])

  /**
   * Cambia el tema activo tanto en el estado local como en el
   * atributo `data-theme`. También guarda la preferencia en localStorage.
   */
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
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" className="size-6">
            <path stroke-linecap="round" strok-linejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
          </svg>

        </button>
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
            className="dropdown-content z-50 menu p-2 shadow bg-base-200 rounded-box w-40"
          >
            {themes.map((t) => (
              <li key={t.value}>
                <input
                  type="radio"
                  name="theme-dropdown"
                  className="theme-controller btn btn-sm btn-block btn-ghost justify-start"
                  aria-label={t.label}
                  value={t.value}
                  checked={theme === t.value}
                  onChange={() => handleThemeChange(t.value)}
                />
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}
