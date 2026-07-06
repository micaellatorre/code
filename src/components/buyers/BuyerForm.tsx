"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import type { BuyerType } from "@prisma/client"
import { fromArgDateInputValue } from "@/lib/timezone"
import { POSTAL_CODE_ERROR_MESSAGE } from "@/lib/domain/argentina/provinces"
import { BUYER_TYPE_LABELS } from "./buyerTypes"
import { normalizeInstagram } from "./buyerUtils"

export type BuyerFormInitialData = {
  id: string
  type: BuyerType
  name: string
  surname: string | null
  businessName: string | null
  dob: string | null
  province: string | null
  provinceId: string | null
  registeredBranchId: string | null
  city: string | null
  postalCode: string | null
  notes: string | null
  phone: string | null
  instagram: string | null
  email: string | null
  addressStreet: string | null
  addressNumber: string | null
  cuit: string | null
  dni: string | null
}

type BuyerFormState = {
  type: BuyerType
  name: string
  surname: string
  businessName: string
  dob: string
  province: string
  provinceId: string
  registeredBranchId: string
  city: string
  postalCode: string
  notes: string
  phone: string
  instagram: string
  email: string
  addressStreet: string
  addressNumber: string
  cuit: string
  dni: string
}

type ProvinceOption = { id: string; name: string; code: string }
type BranchOption = { id: string; name: string; code: string; isActive?: boolean }

type BuyerFormProps = {
  mode: "create" | "edit"
  initialData?: BuyerFormInitialData
}

function initialState(initialData?: BuyerFormInitialData): BuyerFormState {
  return {
    type: initialData?.type ?? "MINORISTA",
    name: initialData?.name ?? "",
    surname: initialData?.surname ?? "",
    businessName: initialData?.businessName ?? "",
    dob: initialData?.dob ? initialData.dob.slice(0, 10) : "",
    province: initialData?.province ?? "",
    provinceId: initialData?.provinceId ?? "",
    registeredBranchId: initialData?.registeredBranchId ?? "",
    city: initialData?.city ?? "",
    postalCode: initialData?.postalCode ?? "",
    notes: initialData?.notes ?? "",
    phone: initialData?.phone ?? "",
    instagram: initialData?.instagram ?? "",
    email: initialData?.email ?? "",
    addressStreet: initialData?.addressStreet ?? "",
    addressNumber: initialData?.addressNumber ?? "",
    cuit: initialData?.cuit ?? "",
    dni: initialData?.dni ?? "",
  }
}

function nullableText(value: string) {
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

async function readApiError(response: Response) {
  const contentType = response.headers.get("content-type") || ""
  if (contentType.includes("application/json")) {
    const body = await response.json().catch(() => null)
    return body?.error || body?.message || "Error inesperado."
  }
  return (await response.text().catch(() => "")) || "Error inesperado."
}

function validate(form: BuyerFormState) {
  if (!form.name.trim()) return "El nombre es obligatorio."
  if (!form.surname.trim()) return "El apellido es obligatorio."
  if (form.postalCode.trim() && !/^(?:\d{4}|[A-Z]\d{4}[A-Z]{3})$/i.test(form.postalCode.trim())) return POSTAL_CODE_ERROR_MESSAGE

  if (form.type === "MINORISTA") {
    if (!form.dni.trim()) return "El DNI es obligatorio para clientes minoristas."
    return null
  }

  if (!form.businessName.trim()) return "La razon social es obligatoria para clientes mayoristas."
  if (!form.cuit.trim()) return "El CUIT es obligatorio para clientes mayoristas."
  return null
}

function buildPayload(form: BuyerFormState) {
  const base = {
    type: form.type,
    name: form.name.trim(),
    surname: form.surname.trim(),
    dob: form.dob ? fromArgDateInputValue(form.dob).toISOString() : null,
    notes: nullableText(form.notes),
    phone: nullableText(form.phone),
    email: nullableText(form.email),
    instagram: normalizeInstagram(form.instagram),
    provinceId: nullableText(form.provinceId),
    registeredBranchId: nullableText(form.registeredBranchId),
    province: nullableText(form.province),
    city: nullableText(form.city),
    postalCode: nullableText(form.postalCode),
    addressStreet: nullableText(form.addressStreet),
    addressNumber: nullableText(form.addressNumber),
  }

  if (form.type === "MINORISTA") {
    return { ...base, dni: nullableText(form.dni) }
  }

  return {
    ...base,
    businessName: nullableText(form.businessName),
    cuit: nullableText(form.cuit),
    dni: nullableText(form.dni),
  }
}

export default function BuyerForm({ mode, initialData }: BuyerFormProps) {
  const router = useRouter()
  const [form, setForm] = useState<BuyerFormState>(() => initialState(initialData))
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [provinces, setProvinces] = useState<ProvinceOption[]>([])
  const [branches, setBranches] = useState<BranchOption[]>([])

  useEffect(() => {
    let cancelled = false
    Promise.all([
      fetch("/api/provinces").then((response) => response.json()).catch(() => ({ provinces: [] })),
      fetch("/api/branches").then((response) => response.json()).catch(() => ({ branches: [] })),
    ]).then(([provincePayload, branchPayload]) => {
      if (cancelled) return
      setProvinces(Array.isArray(provincePayload.provinces) ? provincePayload.provinces : [])
      setBranches(Array.isArray(branchPayload.branches) ? branchPayload.branches : [])
    })
    return () => {
      cancelled = true
    }
  }, [])

  function update<K extends keyof BuyerFormState>(key: K, value: BuyerFormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)

    const validationError = validate(form)
    if (validationError) {
      setError(validationError)
      return
    }

    setIsSubmitting(true)
    try {
      const response = await fetch(mode === "create" ? "/api/buyers" : `/api/buyers/${initialData?.id}`, {
        method: mode === "create" ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload(form)),
      })

      if (!response.ok) throw new Error(await readApiError(response))

      router.push("/dashboard/buyers")
      router.refresh()
    } catch (submitError: any) {
      setError(submitError?.message || "No se pudo guardar el cliente.")
    } finally {
      setIsSubmitting(false)
    }
  }

  const isWholesale = form.type === "MAYORISTA"

  return (
    <form onSubmit={handleSubmit} className="space-y-4 sm:p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold">{mode === "create" ? "Nuevo cliente" : "Editar cliente"}</h1>
          <p className="mt-1 text-sm text-base-content/60">Datos principales segun el tipo de cliente.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="join">
            <button
              type="button"
              className={`btn btn-sm join-item ${form.type === "MINORISTA" ? "btn-primary" : "btn-outline"}`}
              onClick={() => update("type", "MINORISTA")}
              disabled={isSubmitting}
            >
              Minorista
            </button>
            <button
              type="button"
              className={`btn btn-sm join-item ${form.type === "MAYORISTA" ? "btn-primary" : "btn-outline"}`}
              onClick={() => update("type", "MAYORISTA")}
              disabled={isSubmitting}
            >
              Mayorista
            </button>
          </div>
          <Link href="/dashboard/buyers" className="btn btn-ghost btn-sm">
            Volver
          </Link>
        </div>
      </div>

      {error ? <div className="alert alert-error py-3 text-sm">{error}</div> : null}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_320px]">
        <div className="space-y-3">
          <section className="rounded-lg border border-base-300 bg-base-100 p-4">
            <div className="mb-4">
              <h2 className="text-lg font-semibold">Datos</h2>
              <p className="text-sm text-base-content/60">
                {isWholesale ? "Datos del contacto y razon social." : "Datos personales del cliente minorista."}
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <TextField label="Nombre *" value={form.name} onChange={(value) => update("name", value)} disabled={isSubmitting} />
              <TextField label="Apellido *" value={form.surname} onChange={(value) => update("surname", value)} disabled={isSubmitting} />
              {isWholesale ? (
                <>
                  <TextField label="Razon social *" value={form.businessName} onChange={(value) => update("businessName", value)} disabled={isSubmitting} />
                  <TextField label="CUIT *" value={form.cuit} onChange={(value) => update("cuit", value)} disabled={isSubmitting} />
                  <TextField label="DNI" value={form.dni} onChange={(value) => update("dni", value)} disabled={isSubmitting} />
                </>
              ) : (
                <TextField label="DNI *" value={form.dni} onChange={(value) => update("dni", value)} disabled={isSubmitting} />
              )}
              <TextField type="date" label="Fecha de nacimiento" value={form.dob} onChange={(value) => update("dob", value)} disabled={isSubmitting} />
            </div>
          </section>

          <section className="rounded-lg border border-base-300 bg-base-100 p-4">
            <div className="mb-4">
              <h2 className="text-lg font-semibold">Ubicacion comercial</h2>
              <p className="text-sm text-base-content/60">Provincia normalizada y sucursal de registro.</p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <SelectField label="Provincia" value={form.provinceId} onChange={(value) => update("provinceId", value)} disabled={isSubmitting}>
                <option value="">Sin provincia</option>
                {provinces.map((province) => <option key={province.id} value={province.id}>{province.name}</option>)}
              </SelectField>
              <SelectField label="Sucursal de registro" value={form.registeredBranchId} onChange={(value) => update("registeredBranchId", value)} disabled={isSubmitting}>
                <option value="">Sin sucursal</option>
                {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
              </SelectField>
              <TextField label="Localidad" value={form.city} onChange={(value) => update("city", value)} disabled={isSubmitting} />
              <TextField label="Codigo postal" value={form.postalCode} onChange={(value) => update("postalCode", value.toUpperCase())} disabled={isSubmitting} />
              <TextField label="Domicilio calle" value={form.addressStreet} onChange={(value) => update("addressStreet", value)} disabled={isSubmitting} />
              <TextField label="Domicilio numero" value={form.addressNumber} onChange={(value) => update("addressNumber", value)} disabled={isSubmitting} />
            </div>
          </section>

          <section className="rounded-lg border border-base-300 bg-base-100 p-4">
            <div className="mb-4">
              <h2 className="text-lg font-semibold">Contacto</h2>
              <p className="text-sm text-base-content/60">Canales de contacto principales.</p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <TextField label="Telefono" value={form.phone} onChange={(value) => update("phone", value)} disabled={isSubmitting} />
              <TextField type="email" label="Email" value={form.email} onChange={(value) => update("email", value)} disabled={isSubmitting} />
              <TextField label="Instagram" value={form.instagram} onChange={(value) => update("instagram", value)} disabled={isSubmitting} />
            </div>
          </section>

          <section className="rounded-lg border border-base-300 bg-base-100 p-4">
            <div className="mb-4">
              <h2 className="text-lg font-semibold">Notas</h2>
              <p className="text-sm text-base-content/60">Informacion operativa interna del cliente.</p>
            </div>
            <textarea
              className="textarea textarea-bordered min-h-28 w-full"
              value={form.notes}
              onChange={(event) => update("notes", event.target.value)}
              disabled={isSubmitting}
            />
          </section>
        </div>

        <aside className="h-fit rounded-lg border border-base-300 bg-base-100 p-4">
          <h2 className="font-semibold">Resumen</h2>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-base-content/60">Tipo</dt>
              <dd className="font-medium">{BUYER_TYPE_LABELS[form.type]}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-base-content/60">Cliente</dt>
              <dd className="font-medium text-right">
                {isWholesale && form.businessName ? form.businessName : [form.name, form.surname].filter(Boolean).join(" ") || "Pendiente"}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-base-content/60">Documento</dt>
              <dd className="font-medium text-right">{isWholesale ? form.cuit || "Pendiente" : form.dni || "Pendiente"}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-base-content/60">Sucursal</dt>
              <dd className="font-medium text-right">{branches.find((branch) => branch.id === form.registeredBranchId)?.name ?? "Pendiente"}</dd>
            </div>
          </dl>
          <button type="submit" className="btn btn-primary mt-4 w-full" disabled={isSubmitting}>
            {isSubmitting ? <span className="loading loading-spinner loading-xs" /> : null}
            {isSubmitting ? "Guardando..." : mode === "create" ? "Crear cliente" : "Guardar cambios"}
          </button>
        </aside>
      </div>
    </form>
  )
}

function SelectField({
  label,
  value,
  onChange,
  disabled,
  children,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  disabled: boolean
  children: React.ReactNode
}) {
  return (
    <label className="form-control">
      <span className="label">
        <span className="label-text">{label}</span>
      </span>
      <select className="select select-bordered" value={value} onChange={(event) => onChange(event.target.value)} disabled={disabled}>
        {children}
      </select>
    </label>
  )
}

function TextField({
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
    <label className="form-control">
      <span className="label">
        <span className="label-text">{label}</span>
      </span>
      <input
        type={type}
        className="input input-bordered"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
      />
    </label>
  )
}
