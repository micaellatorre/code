"use client"

import { useEffect, useState } from 'react'

export interface SearchBarProps {
  /**
   * Callback opcional que se ejecutará con el nuevo término de búsqueda una
   * vez transcurrido el retraso de debounce. Permite filtrar en cliente o
   * enviar consultas al servidor. Si no se especifica, el componente
   * simplemente mantendrá su estado interno.
   */
  onSearch?: (query: string) => void
  /**
   * Texto placeholder que se muestra cuando el campo está vacío. Por defecto
   * "Buscar...".
   */
  placeholder?: string
}

/**
 * Barra de búsqueda con debounce. Espera 300ms después de que el usuario
 * deje de teclear para disparar el callback `onSearch`. Esto evita
 * búsquedas excesivas en tiempo real y mejora el rendimiento.
 */
export default function SearchBar({ onSearch, placeholder = 'Buscar...' }: SearchBarProps) {
  const [value, setValue] = useState('')
  useEffect(() => {
    // Sólo ejecutar el callback si se proporcionó
    const handle = setTimeout(() => {
      if (onSearch) onSearch(value)
    }, 300)
    return () => clearTimeout(handle)
  }, [value, onSearch])
  return (
    <input
      type="text"
      className="input input-bordered w-full max-w-xs"
      placeholder={placeholder}
      value={value}
      onChange={(e) => setValue(e.target.value)}
    />
  )
}