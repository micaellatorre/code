import type { ReactNode } from 'react'

export interface DashboardKpiCardProps {
  /**
   * Título descriptivo de la métrica, p. ej. "Productos" o "Facturación del día".
   */
  title: string
  /**
   * Valor numérico o string que se desea mostrar. Formatea la cifra antes de
   * pasarla aquí para evitar cálculos en el cliente.
   */
  value: string | number
  /**
   * Elemento opcional que se mostrará como icono decorativo. Puede ser un
   * componente de lucide-react, un emoji o cualquier nodo de React.
   */
  icon?: ReactNode
  /**
   * Tendencia de la métrica en porcentaje (positiva o negativa). Si se
   * proporciona, se mostrará una descripción debajo del valor.
   */
  trend?: number
}

/**
 * Tarjeta reutilizable para mostrar KPIs en el dashboard. Se apoya en los
 * componentes `stat` de DaisyUI para proporcionar un diseño claro y
 * consistente. Ajusta la anchura mediante utilidades de Tailwind (`w-full`,
 * `md:w-1/2`, etc.) en el contenedor padre.
 */
export default function DashboardKpiCard({ title, value, icon, trend }: DashboardKpiCardProps) {
  return (
    <div className="stats shadow bg-base-100">
      <div className="stat">
        {icon && <div className="stat-figure text-primary">{icon}</div>}
        <div className="stat-title">{title}</div>
        <div className="stat-value text-3xl font-semibold">
          {typeof value === 'number' ? value.toLocaleString() : value}
        </div>
        {typeof trend === 'number' && (
          <div className="stat-desc">
            {trend >= 0 ? '+' : ''}
            {trend.toFixed(1)}%
          </div>
        )}
      </div>
    </div>
  )
}