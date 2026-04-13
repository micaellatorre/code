import { BarList } from "@tremor/react"
import DashboardSection from "./DashboardSection"
import type { DashboardBarItem } from "./DashboardTypes"

type DashboardSystemStatsProps = {
  data: DashboardBarItem[]
}

export default function DashboardSystemStats({ data }: DashboardSystemStatsProps) {
  return (
    <DashboardSection title="Metricas del sistema" subtitle="Conteos generales del entorno operativo.">
      <BarList data={data} valueFormatter={(value: number) => value.toLocaleString("es-AR")} color="slate" />
    </DashboardSection>
  )
}
