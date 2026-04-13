"use client"

import { useCallback, useEffect, useState } from "react"
import {
  applyTheme,
  getStoredTheme,
  getSystemTheme,
  persistTheme,
  type ResolvedTheme,
  type ThemeMode,
} from "@/lib/theme"

export function useTheme() {
  const [theme, setThemeState] = useState<ThemeMode>("system")
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>("light")

  useEffect(() => {
    const storedTheme = getStoredTheme()
    setThemeState(storedTheme)
    setResolvedTheme(applyTheme(storedTheme))
  }, [])

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)")

    const handleSystemThemeChange = () => {
      setResolvedTheme((currentResolvedTheme) => {
        const storedTheme = getStoredTheme()

        if (storedTheme !== "system") {
          return currentResolvedTheme
        }

        setThemeState("system")
        return applyTheme("system")
      })
    }

    mediaQuery.addEventListener("change", handleSystemThemeChange)
    return () => mediaQuery.removeEventListener("change", handleSystemThemeChange)
  }, [])

  const setTheme = useCallback((nextTheme: ThemeMode) => {
    persistTheme(nextTheme)
    setThemeState(nextTheme)
    setResolvedTheme(applyTheme(nextTheme))
  }, [])

  return {
    theme,
    resolvedTheme,
    systemTheme: getSystemTheme(),
    setTheme,
  }
}
