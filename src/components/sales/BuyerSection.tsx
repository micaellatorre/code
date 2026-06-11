"use client"

import type { Buyer, BuyerType } from "@prisma/client"
import { useCallback, useEffect, useState } from "react"

type BuyerSectionProps = {
  selectedBuyer: Buyer | null
  setSelectedBuyer: (buyer: Buyer | null) => void
  disabled?: boolean
}

type QuickBuyerDraft = {
  type: BuyerType
  name: string
  surname: string
  dni: string
  businessName: string
  cuit: string
  phone: string
  email: string
  instagram: string
}

const EMPTY_DRAFT: QuickBuyerDraft = {
  type: "MINORISTA",
  name: "",
  surname: "",
  dni: "",
  businessName: "",
  cuit: "",
  phone: "",
  email: "",
  instagram: "",
}

function debounce<F extends (...args: any[]) => any>(func: F, waitFor: number) {
  let timeout: NodeJS.Timeout
  return (...args: Parameters<F>): void => {
    clearTimeout(timeout)
    timeout = setTimeout(() => func(...args), waitFor)
  }
}

function cleanDni(value: string | undefined) {
  return (value ?? "").replace(/\D/g, "").trim()
}

function isValidDni(value: string) {
  return /^\d{7,8}$/.test(value)
}

function normalizeInstagram(value: string) {
  return value.trim().replace(/^@+/, "")
}

async function dniExists(dni: string) {
  try {
    const res = await fetch(`/api/buyers/search?q=${encodeURIComponent(dni)}`)
    if (!res.ok) return false
    const data = await res.json()
    return Array.isArray(data.results) && data.results.some((buyer: Buyer) => cleanDni(buyer?.dni as any) === dni)
  } catch (error) {
    console.error("Failed to validate DNI uniqueness", error)
    return false
  }
}

export default function BuyerSection({ selectedBuyer, setSelectedBuyer, disabled = false }: BuyerSectionProps) {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<Buyer[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [showNewBuyerForm, setShowNewBuyerForm] = useState(false)
  const [newBuyer, setNewBuyer] = useState<QuickBuyerDraft>(EMPTY_DRAFT)
  const [formError, setFormError] = useState<string | null>(null)

  const searchBuyers = async (searchQuery: string) => {
    if (disabled || searchQuery.length < 2) {
      setResults([])
      return
    }

    setIsLoading(true)
    try {
      const res = await fetch(`/api/buyers/search?q=${encodeURIComponent(searchQuery)}`)
      if (res.ok) {
        const data = await res.json()
        setResults(data.results)
      }
    } catch (error) {
      console.error("Failed to search buyers", error)
    } finally {
      setIsLoading(false)
    }
  }

  const debouncedSearch = useCallback(debounce(searchBuyers, 300), [disabled])

  useEffect(() => {
    if (disabled) {
      setResults([])
      return
    }

    debouncedSearch(query)
  }, [disabled, query, debouncedSearch])

  function updateDraft<K extends keyof QuickBuyerDraft>(key: K, value: QuickBuyerDraft[K]) {
    setNewBuyer((prev) => ({ ...prev, [key]: value }))
  }

  function validateDraft() {
    if (!newBuyer.name.trim()) return "El nombre es obligatorio."
    if (!newBuyer.surname.trim()) return "El apellido es obligatorio."

    if (newBuyer.type === "MINORISTA") {
      if (!newBuyer.dni.trim()) return "El DNI es obligatorio para clientes minoristas."
      if (!isValidDni(cleanDni(newBuyer.dni))) return "DNI invalido. Debe ser un numero de 7 u 8 digitos."
      return null
    }

    if (!newBuyer.businessName.trim()) return "La razon social es obligatoria para clientes mayoristas."
    if (!newBuyer.cuit.trim()) return "El CUIT es obligatorio para clientes mayoristas."
    return null
  }

  async function handleCreateBuyer() {
    if (disabled) return

    const validationError = validateDraft()
    if (validationError) {
      setFormError(validationError)
      return
    }

    const dni = cleanDni(newBuyer.dni)
    if (newBuyer.type === "MINORISTA" && (await dniExists(dni))) {
      setFormError("Ya existe un cliente con ese DNI.")
      return
    }

    const payload =
      newBuyer.type === "MINORISTA"
        ? {
            type: "MINORISTA",
            name: newBuyer.name.trim(),
            surname: newBuyer.surname.trim(),
            dni,
            phone: newBuyer.phone.trim() || null,
            email: newBuyer.email.trim() || null,
            instagram: normalizeInstagram(newBuyer.instagram) || null,
          }
        : {
            type: "MAYORISTA",
            name: newBuyer.name.trim(),
            surname: newBuyer.surname.trim(),
            businessName: newBuyer.businessName.trim(),
            cuit: newBuyer.cuit.trim(),
            phone: newBuyer.phone.trim() || null,
            email: newBuyer.email.trim() || null,
            instagram: normalizeInstagram(newBuyer.instagram) || null,
          }

    setFormError(null)
    setIsLoading(true)
    try {
      const res = await fetch("/api/buyers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      if (res.ok) {
        const { buyer: createdBuyer } = await res.json()
        setSelectedBuyer(createdBuyer)
        setShowNewBuyerForm(false)
        setNewBuyer(EMPTY_DRAFT)
        setQuery("")
      } else {
        const data = await res.json().catch(() => null)
        setFormError(data?.error || "No se pudo crear el cliente. Verifique los datos.")
      }
    } catch (error) {
      console.error("Failed to create buyer", error)
      setFormError("No se pudo crear el cliente. Intente nuevamente.")
    } finally {
      setIsLoading(false)
    }
  }

  if (selectedBuyer) {
    const title = selectedBuyer.type === "MAYORISTA" && selectedBuyer.businessName ? selectedBuyer.businessName : `${selectedBuyer.name} ${selectedBuyer.surname ?? ""}`.trim()

    return (
      <div className="card bg-base-100 border border-base-content/50 p-4">
        <h2 className="font-bold text-lg">Datos del Comprador</h2>
        <div className="mt-2 flex items-center justify-between rounded-lg bg-base-200 p-2">
          <div>
            <p className="font-semibold">{title}</p>
            <p className="text-sm text-base-content/70">
              {selectedBuyer.type === "MAYORISTA" ? "Mayorista" : "Minorista"} - DNI: {selectedBuyer.dni || "N/A"} - Instagram: {selectedBuyer.instagram || "N/A"}
            </p>
          </div>
          <button onClick={() => setSelectedBuyer(null)} className="btn btn-sm btn-circle btn-ghost" disabled={disabled}>
            X
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="card bg-base-100 border border-base-content/50 p-4">
      <div className="flex flex-row justify-between items-start">
        <div className="flex flex-col">
          <h2 className="font-bold text-lg">Datos del Comprador</h2>
        </div>
        {!isLoading && !showNewBuyerForm ? (
          <button
            onClick={() => {
              setShowNewBuyerForm(true)
              setFormError(null)
              setNewBuyer({ ...EMPTY_DRAFT, name: query })
            }}
            className="btn btn-primary btn-sm"
            disabled={disabled}
          >
            Agregar Nuevo Cliente
          </button>
        ) : null}
      </div>

      <p className="text-sm text-base-content/70 my-2">Ingresa el nombre, apellido, DNI, CUIT o razon social del cliente</p>

      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Buscar cliente por nombre, apellido, DNI, CUIT..."
        className="input input-bordered w-full"
        disabled={disabled}
      />

      {isLoading ? (
        <div className="flex w-full items-center justify-center">
          <span className="loading loading-spinner loading-sm mt-2" />
        </div>
      ) : null}

      {!isLoading && results.length > 0 ? (
        <ul className="menu bg-base-200 rounded-box mt-2">
          {results.map((buyer) => {
            const label = buyer.type === "MAYORISTA" && buyer.businessName ? buyer.businessName : `${buyer.name} ${buyer.surname ?? ""}`.trim()
            return (
              <li
                key={buyer.id}
                className={disabled ? "disabled" : undefined}
                onClick={() => {
                  if (disabled) return
                  setSelectedBuyer(buyer)
                  setQuery("")
                }}
              >
                <a>
                  <span className="text-base-content/50 uppercase">{buyer.id.slice(-4)}</span>
                  {label}
                  <span className="badge badge-outline badge-xs ml-2">{buyer.type === "MAYORISTA" ? "Mayorista" : "Minorista"}</span>
                  <span className="ml-2 text-sm text-base-content/70">{buyer.instagram || buyer.phone || buyer.email || ""}</span>
                </a>
              </li>
            )
          })}
        </ul>
      ) : null}

      {!isLoading && query.length > 2 && results.length === 0 && !showNewBuyerForm ? (
        <div className="p-4 text-center">
          <p>No se encontraron clientes.</p>
        </div>
      ) : null}

      {showNewBuyerForm ? (
        <div className="mt-4 rounded-box border border-base-300 p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h3 className="font-semibold">Nuevo Cliente</h3>
            <div className="join">
              <button type="button" className={`btn btn-xs join-item ${newBuyer.type === "MINORISTA" ? "btn-primary" : "btn-outline"}`} onClick={() => updateDraft("type", "MINORISTA")}>
                Minorista
              </button>
              <button type="button" className={`btn btn-xs join-item ${newBuyer.type === "MAYORISTA" ? "btn-primary" : "btn-outline"}`} onClick={() => updateDraft("type", "MAYORISTA")}>
                Mayorista
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            <QuickInput label="Nombre *" value={newBuyer.name} onChange={(value) => updateDraft("name", value)} disabled={disabled} />
            <QuickInput label="Apellido *" value={newBuyer.surname} onChange={(value) => updateDraft("surname", value)} disabled={disabled} />
            {newBuyer.type === "MINORISTA" ? (
              <QuickInput label="DNI *" value={newBuyer.dni} onChange={(value) => updateDraft("dni", cleanDni(value))} disabled={disabled} />
            ) : (
              <>
                <QuickInput label="Razon social *" value={newBuyer.businessName} onChange={(value) => updateDraft("businessName", value)} disabled={disabled} />
                <QuickInput label="CUIT *" value={newBuyer.cuit} onChange={(value) => updateDraft("cuit", value)} disabled={disabled} />
              </>
            )}
            <QuickInput label="Telefono" value={newBuyer.phone} onChange={(value) => updateDraft("phone", value)} disabled={disabled} />
            <QuickInput label="Email" type="email" value={newBuyer.email} onChange={(value) => updateDraft("email", value)} disabled={disabled} />
            <QuickInput label="Instagram" value={newBuyer.instagram} onChange={(value) => updateDraft("instagram", value)} disabled={disabled} />
          </div>

          {formError ? <div className="mt-2 text-sm text-error">{formError}</div> : null}

          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setShowNewBuyerForm(false)
                setFormError(null)
              }}
              className="btn btn-ghost"
              disabled={disabled}
            >
              Cancelar
            </button>
            <button type="button" onClick={handleCreateBuyer} className="btn btn-primary" disabled={disabled || isLoading}>
              {isLoading ? "Guardando..." : "Guardar Cliente"}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function QuickInput({
  label,
  value,
  onChange,
  disabled,
  type = "text",
}: {
  label: string
  value: string
  onChange: (value: string) => void
  disabled: boolean
  type?: string
}) {
  return (
    <input
      type={type}
      placeholder={label}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="input input-bordered"
      disabled={disabled}
    />
  )
}
