"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { ChevronDownIcon } from "@heroicons/react/24/solid"
import BranchAutocomplete from "@/components/branches/BranchAutocomplete"
import type { UserBranchOption, UserTenantOption } from "@/lib/domain/users"

type UserRoleValue = "ADMIN" | "VENDEDOR" | "STOCK" | "SOCIO"

export type UserFormUser = {
  id: string
  email: string
  name: string | null
  role: UserRoleValue
  isActive: boolean
  tenantId: string | null
  currentBranchId: string | null
}

type UserFormProps = {
  mode: "create" | "edit"
  roles: UserRoleValue[]
  tenantOptions: UserTenantOption[]
  branches: UserBranchOption[]
  defaultTenantId: string
  defaultBranchId: string | null
  user?: UserFormUser
}

type FormState = {
  email: string
  name: string
  isActive: boolean
  role: UserRoleValue
  tenantId: string
  currentBranchId: string
}

function buildInitialState(props: UserFormProps): FormState {
  return {
    email: props.user?.email ?? "",
    name: props.user?.name ?? "",
    isActive: props.user?.isActive ?? true,
    role: (props.user?.role ?? "VENDEDOR") as UserRoleValue,
    tenantId: props.user?.tenantId ?? props.defaultTenantId,
    currentBranchId: props.user?.currentBranchId ?? props.defaultBranchId ?? "",
  }
}

export default function UserForm(props: UserFormProps) {
  const router = useRouter()
  const [form, setForm] = useState<FormState>(() => buildInitialState(props))
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const selectedTenant = props.tenantOptions.find((tenant) => tenant.tenantId === form.tenantId) ?? null
  const tenantBranches = useMemo(
    () => props.branches.filter((branch) => branch.tenantId === form.tenantId),
    [props.branches, form.tenantId],
  )

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function setTenant(tenantId: string) {
    setForm((prev) => {
      const nextBranch = props.branches.find((branch) => branch.tenantId === tenantId && branch.id === prev.currentBranchId)
        ?? props.branches.find((branch) => branch.tenantId === tenantId)
      return {
        ...prev,
        tenantId,
        currentBranchId: nextBranch?.id ?? "",
      }
    })
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    setSaving(true)

    const response = await fetch(props.mode === "create" ? "/api/users" : `/api/users/${props.user?.id}`, {
      method: props.mode === "create" ? "POST" : "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    })
    const payload = await response.json().catch(() => null)
    setSaving(false)

    if (!response.ok) {
      setError(payload?.error ?? "No se pudo guardar el usuario")
      return
    }

    const userId = payload?.user?.id
    if (props.mode === "create" && userId) {
      router.push(`/dashboard/users/new/success?userId=${encodeURIComponent(userId)}`)
    } else {
      router.push("/dashboard/users")
    }
    router.refresh()
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {error ? <div className="alert alert-error text-sm">{error}</div> : null}

      <section className="space-y-3 rounded-lg border border-base-300 bg-base-100 p-4">
        <div>
          <h2 className="text-lg font-semibold">Datos de acceso</h2>
          <p className="text-sm text-base-content/60">El email debe coincidir con la cuenta de Google que usara para ingresar.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="form-control">
            <span className="label-text">Email *</span>
            <input
              className="input input-bordered"
              type="email"
              value={form.email}
              onChange={(event) => setField("email", event.target.value)}
              required
            />
          </label>
          <label className="form-control">
            <span className="label-text">Nombre *</span>
            <input
              className="input input-bordered"
              value={form.name}
              onChange={(event) => setField("name", event.target.value)}
              required
            />
          </label>
          <label className="form-control">
            <span className="label-text">Rol *</span>
            <select
              className="select select-bordered"
              value={form.role}
              onChange={(event) => setField("role", event.target.value as UserRoleValue)}
            >
              {props.roles.map((role) => <option key={role} value={role}>{role}</option>)}
            </select>
          </label>
          <label className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-base-300 px-4 py-3">
            <span>
              <span className="block text-sm font-medium">Usuario activo</span>
              <span className="block text-xs text-base-content/60">Puede iniciar sesion si su email existe en Google.</span>
            </span>
            <input
              type="checkbox"
              className="toggle toggle-primary"
              checked={form.isActive}
              onChange={(event) => setField("isActive", event.target.checked)}
            />
          </label>
        </div>
      </section>

      <section className="space-y-3 rounded-lg border border-base-300 bg-base-100 p-4">
        <div>
          <h2 className="text-lg font-semibold">Tenant y sucursal</h2>
          <p className="text-sm text-base-content/60">Se precargan desde tu contexto actual y solo se puede elegir dentro de tu alcance administrativo.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <TenantAutocomplete
            value={form.tenantId}
            selected={selectedTenant}
            options={props.tenantOptions}
            onChange={setTenant}
          />
          <BranchAutocomplete
            value={form.currentBranchId || null}
            branches={tenantBranches}
            onChange={(branchId) => setField("currentBranchId", branchId)}
            placeholder="Sucursal del usuario"
          />
        </div>
        {form.role === "ADMIN" ? (
          <div className="alert alert-info text-sm">
            Los usuarios ADMIN reciben cobertura automatica sobre todas las sucursales activas del tenant seleccionado.
          </div>
        ) : (
          <div className="alert text-sm">
            La sucursal elegida se asigna como sucursal actual y cobertura inicial. La cobertura ampliada se administra desde la tabla principal.
          </div>
        )}
      </section>

      <div className="sticky bottom-0 z-10 flex justify-end gap-2 border-t border-base-300 bg-base-100/95 px-1 py-3 backdrop-blur">
        <button type="button" className="btn btn-ghost" onClick={() => router.push("/dashboard/users")} disabled={saving}>Cancelar</button>
        <button type="submit" className="btn btn-primary" disabled={saving || !form.currentBranchId}>
          {saving ? <span className="loading loading-spinner loading-xs" /> : null}
          {props.mode === "create" ? "Crear usuario" : "Guardar cambios"}
        </button>
      </div>
    </form>
  )
}

function TenantAutocomplete({
  value,
  selected,
  options,
  onChange,
}: {
  value: string
  selected: UserTenantOption | null
  options: UserTenantOption[]
  onChange: (tenantId: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return options
    return options.filter((option) => `${option.tenantName} ${option.tenantId} ${option.adminName ?? ""} ${option.adminEmail}`.toLowerCase().includes(needle))
  }, [options, query])

  function choose(option: UserTenantOption) {
    onChange(option.tenantId)
    setQuery("")
    setOpen(false)
  }

  return (
    <div className="relative min-w-44">
      <label className="form-control">
        <span className="label-text">Tenant *</span>
        <div className="relative">
          <input
            className="input input-bordered w-full pr-9"
            value={open ? query : selected?.tenantName ?? value}
            placeholder={selected?.tenantName ?? value}
            onFocus={() => setOpen(true)}
            onChange={(event) => {
              setQuery(event.target.value)
              setOpen(true)
            }}
            onBlur={() => window.setTimeout(() => setOpen(false), 120)}
            required
          />
          <ChevronDownIcon className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-base-content/50" />
        </div>
      </label>
      {open ? (
        <div className="absolute z-50 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-base-300 bg-base-100 p-1 shadow-xl">
          {filtered.length ? filtered.map((option) => (
            <button
              key={`${option.tenantId}-${option.adminUserId}`}
              type="button"
              className={`block w-full rounded-md px-2 py-2 text-left text-sm ${option.tenantId === value ? "bg-primary/10 text-primary" : "hover:bg-base-200"}`}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => choose(option)}
            >
              <span className="block font-medium">{option.tenantName}</span>
              <span className="block text-xs text-base-content/50">Tenant: {option.tenantId}</span>
              <span className="block text-xs text-base-content/50">Admin: {option.adminName ?? option.adminEmail}</span>
            </button>
          )) : <div className="px-2 py-3 text-sm text-base-content/60">Sin resultados</div>}
        </div>
      ) : null}
    </div>
  )
}
