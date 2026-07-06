"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import BranchAutocomplete, { type BranchOption } from "./BranchAutocomplete"

export default function BranchContextSwitcher() {
  const router = useRouter()
  const { update } = useSession()
  const [branches, setBranches] = useState<BranchOption[]>([])
  const [currentBranch, setCurrentBranch] = useState<BranchOption | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetch("/api/users/me/branches", { cache: "no-store" })
      .then((response) => response.json())
      .then((payload) => {
        if (cancelled) return
        setBranches(Array.isArray(payload.branches) ? payload.branches : [])
        setCurrentBranch(payload.currentBranch ?? null)
        setError(payload.error ?? null)
      })
      .catch(() => {
        if (!cancelled) setError("No se pudo cargar la sucursal actual.")
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  async function changeBranch(branchId: string) {
    if (branchId === currentBranch?.id) return
    setSaving(true)
    setError(null)
    try {
      const response = await fetch("/api/users/me/current-branch", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ branchId }),
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok) throw new Error(payload?.error ?? "No se pudo cambiar la sucursal.")
      setCurrentBranch(payload.currentBranch)
      await update()
      router.refresh()
    } catch (changeError) {
      setError(changeError instanceof Error ? changeError.message : "No se pudo cambiar la sucursal.")
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <span className="loading loading-spinner loading-xs" />
  if (!branches.length) return <span className="badge badge-warning badge-sm">Sin sucursal activa</span>

  return (
    <div className="flex max-w-64 flex-col items-start gap-1 text-xs">
      <div className="flex items-center gap-2">
        <span className="text-base-content/50">Sucursal</span>
        {branches.length === 1 ? (
          <span className="badge badge-ghost badge-sm">{branches[0].name}</span>
        ) : (
          <BranchAutocomplete value={currentBranch?.id ?? null} branches={branches} onChange={changeBranch} compact loading={saving} />
        )}
      </div>
      {error ? <span className="text-[0.7rem] leading-tight text-warning">{error}</span> : null}
    </div>
  )
}
