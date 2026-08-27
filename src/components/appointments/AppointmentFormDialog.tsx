"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { FormDialog } from "@/components/ui/dialog"
import NewAppointmentForm from "@/app/dashboard/appointments/new/form"
import EditAppointmentForm from "@/app/dashboard/appointments/[id]/edit/form"

type AppointmentFormDialogProps = {
  mode: "create" | "edit"
  appointmentId?: string
}

export default function AppointmentFormDialog({ mode, appointmentId }: AppointmentFormDialogProps) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  function closeDialog() {
    router.back()
  }

  function handleSuccess() {
    router.refresh()
    closeDialog()
  }

  return (
    <FormDialog
      open
      title={mode === "create" ? "Nueva cita" : "Editar cita"}
      description="Gestiona cliente, productos de interes, sena, Plan Canje y seguimiento comercial."
      size="fullscreen"
      responsiveFullscreen={false}
      loading={busy}
      closeOnEscape={!busy}
      closeOnBackdrop={!busy}
      onClose={closeDialog}
    >
      {mode === "create" ? (
        <NewAppointmentForm presentation="dialog" onSubmittingChange={setBusy} onSuccess={handleSuccess} />
      ) : (
        <EditAppointmentForm id={appointmentId ?? ""} presentation="dialog" onSubmittingChange={setBusy} onSuccess={handleSuccess} />
      )}
    </FormDialog>
  )
}
