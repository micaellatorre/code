"use client"

import { Button, Dialog, DialogPanel, Switch } from "@tremor/react"
import type { DashboardWidgetKey } from "./DashboardTypes"

export type DashboardWidgetDefinition = {
  key: DashboardWidgetKey
  label: string
  description: string
}

type DashboardWidgetToggleDialogProps = {
  open: boolean
  onClose: (open: boolean) => void
  widgets: DashboardWidgetDefinition[]
  visibleWidgets: Record<DashboardWidgetKey, boolean>
  onToggle: (key: DashboardWidgetKey, value: boolean) => void
}

export default function DashboardWidgetToggleDialog({
  open,
  onClose,
  widgets,
  visibleWidgets,
  onToggle,
}: DashboardWidgetToggleDialogProps) {
  return (
    <Dialog open={open} onClose={onClose}>
      <DialogPanel className="max-w-xl rounded-lg bg-base-100 text-base-content">
        <div className="border-b border-base-content/10 pb-4">
          <h3 className="text-lg font-semibold text-base-content">Personalizar dashboard</h3>
          <p className="mt-1 text-sm text-base-content/60">
            Activa o desactiva widgets. La preferencia se guarda junto con tus filtros locales para el rol activo.
          </p>
        </div>
        <div className="mt-5 space-y-4">
          {widgets.map((widget) => (
            <div
              key={widget.key}
              className="flex items-center justify-between gap-4 rounded-lg border border-base-content/10 p-4"
            >
              <div>
                <div className="text-sm font-medium text-base-content">{widget.label}</div>
                <div className="mt-1 text-sm text-base-content/60">{widget.description}</div>
              </div>
              <Switch checked={visibleWidgets[widget.key]} onChange={(value) => onToggle(widget.key, value)} />
            </div>
          ))}
        </div>
        <div className="mt-6 flex justify-end">
          <Button onClick={() => onClose(false)}>Listo</Button>
        </div>
      </DialogPanel>
    </Dialog>
  )
}
