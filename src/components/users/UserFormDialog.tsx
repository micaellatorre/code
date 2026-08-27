"use client"

import { useId, useState } from "react"
import { useRouter } from "next/navigation"
import { FormDialog } from "@/components/ui/dialog"
import { useConfirmDialog } from "@/components/ui/confirm-dialog"
import UserForm, { type UserFormUser } from "./UserForm"
import type { UserBranchOption, UserTenantOption } from "@/lib/domain/users"

type UserRoleValue = "ADMIN" | "VENDEDOR" | "STOCK" | "SOCIO"

type UserFormDialogProps = {
  mode: "create" | "edit"
  roles: UserRoleValue[]
  tenantOptions: UserTenantOption[]
  branches: UserBranchOption[]
  defaultTenantId: string
  defaultBranchId: string | null
  user?: UserFormUser
}

export default function UserFormDialog(props: UserFormDialogProps) {
  const router = useRouter()
  const confirmDialog = useConfirmDialog()
  const formId = useId()
  const [dirty, setDirty] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [canSubmit, setCanSubmit] = useState(true)

  function closeDialog() {
    router.back()
  }

  async function confirmClose() {
    if (!dirty) return true
    return confirmDialog.confirm({
      variant: "warning",
      title: "Descartar cambios",
      description: "Hay informacion modificada en el formulario. Si cerras ahora, esos cambios se perderan.",
      confirmLabel: "Descartar",
      cancelLabel: "Seguir editando",
    })
  }

  return (
    <FormDialog
      open
      title={props.mode === "create" ? "Nuevo usuario" : "Editar usuario"}
      description="Administra acceso, rol, tenant y sucursal inicial del usuario."
      size="lg"
      responsiveFullscreen
      loading={submitting}
      dirty={dirty}
      onBeforeClose={confirmClose}
      onClose={closeDialog}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={closeDialog} disabled={submitting}>
            Cancelar
          </button>
          <button type="submit" form={formId} className="btn btn-primary" disabled={submitting || !canSubmit}>
            {submitting ? <span className="loading loading-spinner loading-xs" /> : null}
            {props.mode === "create" ? "Crear usuario" : "Guardar cambios"}
          </button>
        </>
      }
    >
      <UserForm
        {...props}
        formId={formId}
        hideActions
        onDirtyChange={setDirty}
        onCanSubmitChange={setCanSubmit}
        onSubmittingChange={setSubmitting}
        onCancel={closeDialog}
        onSuccess={() => {
          router.refresh()
          closeDialog()
        }}
      />
    </FormDialog>
  )
}
