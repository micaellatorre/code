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
  placeholder?: string,
  search?: string
}

/**
 * Barra de búsqueda con debounce. Espera 300ms después de que el usuario
 * deje de teclear para disparar el callback `onSearch`. Esto evita
 * búsquedas excesivas en tiempo real y mejora el rendimiento.
 */
export default function SearchBar({ onSearch, placeholder = 'Buscar...', search }: SearchBarProps) {

  // value state
  const [inputValue, setInputValue] = useState(search || '')

  // effect para debounce
  useEffect(() => {
    const handler = setTimeout(() => {
      if (onSearch) {
        onSearch(inputValue)
      }
    }, 300)

    return () => {
      clearTimeout(handler)
    }
  }, [inputValue, onSearch])

  // effect para actualizar el valor si cambia la prop search
  useEffect(() => {
    if (search !== undefined) {
      setInputValue(search)
    }
  }, [search])

  return (
    <>
      <input
        type="text"
        className="input input-bordered w-full max-w-xs"
        placeholder={placeholder}
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
      />
      {search ? (
        <button
          type="button"
          aria-label="Limpiar búsqueda"
          onClick={() => setInputValue('')}
          className="btn btn-ghost btn-sm"
        >
          ✕
        </button>
      ) : null}
    </>
  )
}