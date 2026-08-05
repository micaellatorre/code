"use client"

import { useEffect, useId, useMemo, useRef, useState } from "react"
import { ChevronUpDownIcon, XMarkIcon } from "@heroicons/react/24/outline"
import ProductColorSwatch from "@/components/products/ProductColorSwatch"

export type CatalogAutocompleteOption<T = unknown> = {
  id: string
  label: string
  description?: string | null
  metadata?: string | null
  swatchColor?: string | null
  source?: string | null
  isActive?: boolean | null
  item?: T
}

type CatalogAutocompleteProps<T = unknown> = {
  label: string
  placeholder?: string
  value: CatalogAutocompleteOption<T> | null
  options: CatalogAutocompleteOption<T>[]
  loading?: boolean
  error?: string | null
  disabled?: boolean
  required?: boolean
  allowCreate?: boolean
  emptyLabel?: string
  onSearchChange: (value: string) => void
  onChange: (option: CatalogAutocompleteOption<T> | null) => void
  onCreate?: (query: string) => void
}

function normalizeForCompare(value: string) {
  return value
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
}

export default function CatalogAutocomplete<T = unknown>({
  label,
  placeholder,
  value,
  options,
  loading = false,
  error = null,
  disabled = false,
  required = false,
  allowCreate = false,
  emptyLabel = "No se encontraron resultados",
  onSearchChange,
  onChange,
  onCreate,
}: CatalogAutocompleteProps<T>) {
  const inputId = useId()
  const listboxId = `${inputId}-listbox`
  const rootRef = useRef<HTMLDivElement | null>(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState(value?.label ?? "")
  const [activeIndex, setActiveIndex] = useState(0)

  useEffect(() => {
    if (!open) setQuery(value?.label ?? "")
  }, [open, value?.label])

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false)
        setQuery(value?.label ?? "")
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [value?.label])

  const exactMatch = useMemo(() => {
    const normalizedQuery = normalizeForCompare(query)
    return Boolean(normalizedQuery && options.some((option) => normalizeForCompare(option.label) === normalizedQuery))
  }, [options, query])

  const createLabel = query.trim() && !exactMatch ? `Agregar "${query.trim()}" +` : "Agregar Nuevo +"
  const hasCreateAction = allowCreate && Boolean(onCreate)
  const optionCount = options.length + (hasCreateAction ? 1 : 0)

  function updateQuery(nextQuery: string) {
    setQuery(nextQuery)
    setOpen(true)
    setActiveIndex(0)
    onSearchChange(nextQuery)
  }

  function selectOption(option: CatalogAutocompleteOption<T>) {
    onChange(option)
    setQuery(option.label)
    setOpen(false)
  }

  function clearSelection() {
    onChange(null)
    setQuery("")
    onSearchChange("")
    setActiveIndex(0)
    setOpen(false)
  }

  function triggerCreate() {
    if (!hasCreateAction || disabled) return
    onCreate?.(query.trim())
    setOpen(false)
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault()
      setOpen(true)
      setActiveIndex((index) => (optionCount ? Math.min(index + 1, optionCount - 1) : 0))
      return
    }
    if (event.key === "ArrowUp") {
      event.preventDefault()
      setOpen(true)
      setActiveIndex((index) => Math.max(index - 1, 0))
      return
    }
    if (event.key === "Escape") {
      event.preventDefault()
      setOpen(false)
      setQuery(value?.label ?? "")
      return
    }
    if (event.key === "Enter" && open) {
      event.preventDefault()
      const option = options[activeIndex]
      if (option) selectOption(option)
      else if (activeIndex === options.length) triggerCreate()
    }
  }

  return (
    <div ref={rootRef} className="form-control relative">
      <label className="label" htmlFor={inputId}>
        <span className="label-text">
          {label}
          {required ? " *" : ""}
        </span>
      </label>
      <div className="relative">
        <input
          id={inputId}
          type="text"
          className={`input input-bordered w-full pr-20 ${error ? "input-error" : ""}`}
          placeholder={placeholder}
          value={query}
          disabled={disabled}
          required={required && !value}
          role="combobox"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-invalid={Boolean(error)}
          autoComplete="off"
          onFocus={() => {
            setOpen(true)
            onSearchChange(query)
          }}
          onChange={(event) => updateQuery(event.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => {
            window.setTimeout(() => {
              if (!rootRef.current?.contains(document.activeElement)) {
                setOpen(false)
                setQuery(value?.label ?? "")
              }
            }, 0)
          }}
        />
        <div className="absolute inset-y-0 right-2 flex items-center gap-1">
          {loading ? <span className="loading loading-spinner loading-xs" /> : null}
          {value && !disabled ? (
            <button
              type="button"
              className="btn btn-ghost btn-xs btn-square"
              title="Limpiar"
              aria-label={`Limpiar ${label}`}
              onClick={clearSelection}
            >
              <XMarkIcon className="size-4" />
            </button>
          ) : null}
          <button
            type="button"
            className="btn btn-ghost btn-xs btn-square"
            title="Mostrar opciones"
            aria-label={`Mostrar opciones de ${label}`}
            disabled={disabled}
            onClick={() => {
              setOpen((current) => !current)
              onSearchChange(query)
            }}
          >
            <ChevronUpDownIcon className="size-4" />
          </button>
        </div>
      </div>
      {open && !disabled ? (
        <div
          id={listboxId}
          role="listbox"
          className="absolute left-0 right-0 top-full z-40 mt-1 max-h-72 overflow-y-auto rounded-lg border border-base-300 bg-base-100 p-1 shadow-xl"
        >
          {options.length === 0 && !loading ? (
            <div className="px-3 py-2 text-sm text-base-content/60">{emptyLabel}</div>
          ) : null}
          {options.map((option, index) => {
            const active = activeIndex === index
            const selected = value?.id === option.id
            return (
              <button
                key={option.id}
                type="button"
                role="option"
                aria-selected={active || selected}
                className={`flex w-full items-start gap-2 rounded-md px-3 py-2 text-left text-sm hover:bg-base-200 ${active ? "bg-base-200" : ""}`}
                onMouseEnter={() => setActiveIndex(index)}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => selectOption(option)}
              >
                {option.swatchColor ? <ProductColorSwatch hexColor={option.swatchColor} className="mt-0.5 size-4" /> : null}
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{option.label}</span>
                  {option.description || option.metadata ? (
                    <span className="block truncate text-xs text-base-content/60">
                      {[option.description, option.metadata].filter(Boolean).join(" - ")}
                    </span>
                  ) : null}
                </span>
                {option.source ? <span className="badge badge-ghost badge-xs">{option.source}</span> : null}
                {option.isActive === false ? <span className="badge badge-warning badge-xs">Inactivo</span> : null}
              </button>
            )
          })}
          {hasCreateAction ? (
            <button
              type="button"
              role="option"
              aria-selected={activeIndex === options.length}
              className={`mt-1 flex w-full items-center justify-center rounded-md border border-dashed border-primary/40 px-3 py-2 text-sm font-medium text-primary hover:bg-primary/10 ${activeIndex === options.length ? "bg-primary/10" : ""}`}
              onMouseEnter={() => setActiveIndex(options.length)}
              onMouseDown={(event) => event.preventDefault()}
              onClick={triggerCreate}
            >
              {createLabel}
            </button>
          ) : null}
        </div>
      ) : null}
      {error ? <span className="label-text-alt mt-1 text-error">{error}</span> : null}
    </div>
  )
}
