"use client"

import { ComputerDesktopIcon, MoonIcon, SunIcon } from "@heroicons/react/24/solid"
import { useTheme } from "@/hooks/useTheme"
import type { ThemeMode } from "@/lib/theme"
import type { ComponentType, SVGProps } from "react"

const themeOptions: Array<{
  value: ThemeMode
  label: string
  description: string
  icon: ComponentType<SVGProps<SVGSVGElement>>
}> = [
  {
    value: "light",
    label: "Light",
    description: "Tema claro",
    icon: SunIcon,
  },
  {
    value: "dark",
    label: "Dark",
    description: "Tema oscuro",
    icon: MoonIcon,
  },
  {
    value: "system",
    label: "System",
    description: "Usar sistema",
    icon: ComputerDesktopIcon,
  },
]

export default function ThemeSwitcher() {
  const { theme, resolvedTheme, setTheme } = useTheme()

  const activeOption = themeOptions.find((option) => option.value === theme)

  return (
    <div className="dropdown dropdown-end">
      <div tabIndex={0} role="button" className="btn btn-sm bg-base-200 border-0 shadow-none">
        Tema: {activeOption?.label ?? "System"}
        <span className="badge badge-xs badge-outline ml-1">{resolvedTheme}</span>
      </div>

      <ul tabIndex={0} className="dropdown-content z-[80] menu p-2 shadow-lg bg-base-200 rounded-box w-56">
        {themeOptions.map((option) => {
          const Icon = option.icon
          const isSelected = option.value === theme

          return (
            <li key={option.value}>
              <button
                type="button"
                className={isSelected ? "active" : undefined}
                onClick={() => setTheme(option.value)}
              >
                <Icon className="size-4" />
                <span className="flex flex-col items-start">
                  <span>{option.label}</span>
                  <span className="text-xs opacity-60">{option.description}</span>
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
