"use client"

type AppointmentNotesStepProps = {
  notes: string
  setNotes: (value: string) => void
}

export default function AppointmentNotesStep({ notes, setNotes }: AppointmentNotesStepProps) {
  return (
    <label className="form-control">
      <span className="label-text mb-1">Notas</span>
      <textarea
        value={notes}
        onChange={(event) => setNotes(event.target.value)}
        className="textarea textarea-bordered min-h-44"
        placeholder="El cliente requiere facturacion A, necesita retirar a las 18 hs, prefiere envio por transporte, quiere confirmar color, etc."
      />
    </label>
  )
}
