"use client"

import AppointmentInterestSection, { type AppointmentInterestDraft } from "@/components/appointments/AppointmentInterestSection"

type AppointmentItemsStepProps = {
  items: AppointmentInterestDraft[]
  setItems: (items: AppointmentInterestDraft[]) => void
}

export default function AppointmentItemsStep({ items, setItems }: AppointmentItemsStepProps) {
  return <AppointmentInterestSection items={items} setItems={setItems} />
}
