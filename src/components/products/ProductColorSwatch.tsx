type ProductColorSwatchProps = {
  hexColor?: string | null
  className?: string
  title?: string
}

function isLightHex(hexColor: string) {
  const normalized = hexColor.replace("#", "")
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) return false
  const red = Number.parseInt(normalized.slice(0, 2), 16)
  const green = Number.parseInt(normalized.slice(2, 4), 16)
  const blue = Number.parseInt(normalized.slice(4, 6), 16)
  return (red * 299 + green * 587 + blue * 114) / 1000 > 190
}

export default function ProductColorSwatch({ hexColor, className = "", title }: ProductColorSwatchProps) {
  if (!hexColor) return null
  const borderClass = isLightHex(hexColor) ? "border-base-content/30" : "border-base-content/10"
  return (
    <span
      aria-hidden="true"
      title={title ?? hexColor}
      className={`inline-block size-3.5 shrink-0 rounded-full border ${borderClass} ${className}`}
      style={{ backgroundColor: hexColor }}
    />
  )
}
