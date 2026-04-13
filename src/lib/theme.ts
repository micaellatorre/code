export type ThemeMode = "light" | "dark" | "system"
export type ResolvedTheme = "light" | "dark"

export const THEME_STORAGE_KEY = "theme"

const themeModes: ThemeMode[] = ["light", "dark", "system"]

export function isThemeMode(value: string | null): value is ThemeMode {
  return value !== null && themeModes.includes(value as ThemeMode)
}

export function getSystemTheme(): ResolvedTheme {
  if (typeof window === "undefined") {
    return "light"
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
}

export function resolveTheme(theme: ThemeMode): ResolvedTheme {
  return theme === "system" ? getSystemTheme() : theme
}

export function getStoredTheme(): ThemeMode {
  if (typeof window === "undefined") {
    return "system"
  }

  const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY)
  return isThemeMode(storedTheme) ? storedTheme : "system"
}

export function applyTheme(theme: ThemeMode): ResolvedTheme {
  const resolvedTheme = resolveTheme(theme)

  if (typeof document !== "undefined") {
    document.documentElement.setAttribute("data-theme", resolvedTheme)
    document.documentElement.style.colorScheme = resolvedTheme
  }

  return resolvedTheme
}

export function persistTheme(theme: ThemeMode) {
  if (typeof window === "undefined") {
    return
  }

  window.localStorage.setItem(THEME_STORAGE_KEY, theme)
}
