"use client"

import { useMemo, useRef, useState } from "react"
import { ChevronDownIcon } from "@heroicons/react/24/solid"

export type BranchOption = {
  id: string
  code: string
  name: string
}

type Props = {
  value: string | null
  branches: BranchOption[]
  onChange: (branchId: string) => void
  disabled?: boolean
  compact?: boolean
  placeholder?: string
  loading?: boolean
  allowClear?: boolean
}

export default function BranchAutocomplete({
  value,
  branches,
  onChange,
  disabled,
  compact,
  placeholder = "Seleccionar sucursal",
  loading,
}: Props) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [activeIndex, setActiveIndex] = useState(0)
  const wrapperRef = useRef<HTMLDivElement | null>(null)
  const selected = branches.find((branch) => branch.id === value) ?? null
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return branches
    return branches.filter((branch) => `${branch.name} ${branch.code}`.toLowerCase().includes(needle))
  }, [branches, query])

  function choose(branch: BranchOption) {
    onChange(branch.id)
    setQuery("")
    setOpen(false)
    setActiveIndex(0)
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement | HTMLButtonElement>) {
    if (disabled) return
    if (event.key === "ArrowDown") {
      event.preventDefault()
      setOpen(true)
      setActiveIndex((prev) => Math.min(prev + 1, filtered.length - 1))
    }
    if (event.key === "ArrowUp") {
      event.preventDefault()
      setActiveIndex((prev) => Math.max(prev - 1, 0))
    }
    if (event.key === "Enter" && open && filtered[activeIndex]) {
      event.preventDefault()
      choose(filtered[activeIndex])
    }
    if (event.key === "Escape") {
      setOpen(false)
      setQuery("")
    }
  }

  if (compact && !open) {
    return (
      <button
        type="button"
        className="inline-flex max-w-44 items-center gap-1 rounded px-1 py-0.5 text-left hover:bg-base-200 disabled:hover:bg-transparent"
        disabled={disabled}
        onClick={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        title={selected?.name ?? placeholder}
      >
        <span className="truncate">{selected?.name ?? placeholder}</span>
        {!disabled ? <ChevronDownIcon className="size-3 shrink-0" /> : null}
      </button>
    )
  }

  return (
    <div ref={wrapperRef} className="relative min-w-44">
      <label className={compact ? "" : "form-control"}>
        {!compact ? <span className="label-text">Sucursal *</span> : null}
        <div className="relative">
          <input
            autoFocus={compact}
            className={compact ? "input input-bordered input-xs w-full" : "input input-bordered w-full"}
            disabled={disabled}
            value={open ? query : selected?.name ?? ""}
            placeholder={selected?.name ?? placeholder}
            onFocus={() => setOpen(true)}
            onChange={(event) => {
              setQuery(event.target.value)
              setOpen(true)
              setActiveIndex(0)
            }}
            onKeyDown={handleKeyDown}
            onBlur={() => window.setTimeout(() => setOpen(false), 120)}
          />
          {loading ? <span className="loading loading-spinner loading-xs absolute right-2 top-1/2 -translate-y-1/2" /> : null}
        </div>
      </label>
      {open && !disabled ? (
        <div className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-base-300 bg-base-100 p-1 shadow-xl">
          {filtered.length ? filtered.map((branch, index) => (
            <button
              key={branch.id}
              type="button"
              className={`block w-full rounded-md px-2 py-2 text-left text-sm ${index === activeIndex ? "bg-primary/10 text-primary" : "hover:bg-base-200"}`}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => choose(branch)}
            >
              <span className="block font-medium">{branch.name}</span>
              <span className="text-xs text-base-content/50">Codigo: {branch.code}</span>
            </button>
          )) : <div className="px-2 py-3 text-sm text-base-content/60">Sin resultados</div>}
        </div>
      ) : null}
    </div>
  )
}
