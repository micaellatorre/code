import Link from 'next/link'

export interface BreadcrumbItem {
  /** Texto visible para este paso en el breadcrumb. */
  label: string
  /**
   * Ruta a la que debe enlazar este paso. Si no se especifica, se
   * interpretará como la página actual y el texto no será clicable.
   */
  href?: string
}

/**
 * Componente de Breadcrumbs. Muestra la ruta de navegación actual como una
 * lista ordenada de enlaces. Utiliza el estilo `breadcrumbs` de DaisyUI
 * para un diseño limpio. Para la última entrada de la lista, si no se
 * proporciona `href`, se renderiza como texto plano.
 */
export default function Breadcrumbs({ items }: { items: BreadcrumbItem[] }) {
  if (!items || items.length === 0) return null
  return (
    <div className="breadcrumbs text-sm sm:mb-2">
      <ul>
        {items.map((item, index) => (
          <li key={index}>
            {item.href ? <Link href={item.href}>{item.label}</Link> : <span>{item.label}</span>}
          </li>
        ))}
      </ul>
    </div>
  )
}