"use client"

import { DocumentDuplicateIcon } from "@heroicons/react/24/outline"
import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react"

type ImeiDisplayProps = {
  imei?: string | null
  className?: string
  fallback?: ReactNode
  copyOnClick?: boolean
}

function CopyFeedback() {
  return (
    <span className="relative ml-1 inline-flex h-[1.1em] min-w-0 items-center align-middle">
      <DocumentDuplicateIcon
        aria-hidden="true"
        className="size-[1em] max-w-0 -rotate-12 scale-90 overflow-hidden text-base-content/60 opacity-0 transition-all duration-200 ease-out group-hover:max-w-[1.1em] group-hover:rotate-0 group-hover:scale-100 group-hover:opacity-70 group-focus:max-w-[1.1em] group-focus:rotate-0 group-focus:scale-100 group-focus:opacity-70 group-focus-within:max-w-[1.1em] group-focus-within:rotate-0 group-focus-within:scale-100 group-focus-within:opacity-70 group-data-[copied=true]:max-w-0 group-data-[copied=true]:rotate-90 group-data-[copied=true]:scale-75 group-data-[copied=true]:opacity-0"
      />
      <span className="text-nowrap inline-block max-w-0 origin-left -rotate-6 scale-75 overflow-hidden text-[0.75em] font-normal text-success opacity-0 transition-all duration-200 ease-out group-data-[copied=true]:max-w-[8ch] group-data-[copied=true]:rotate-0 group-data-[copied=true]:scale-100 group-data-[copied=true]:opacity-80">
        Copiado
      </span>
    </span>
  )
}

export default function ImeiDisplay({ imei, className = "", fallback = "-", copyOnClick = true }: ImeiDisplayProps) {
  const [copied, setCopied] = useState(false)
  const feedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const normalized = imei?.trim()

  useEffect(() => {
    return () => {
      if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current)
    }
  }, [])

  if (!normalized) return <>{fallback}</>

  const copyImei = async () => {
    if (!normalized || typeof window === "undefined") return

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(normalized)
      } else {
        const textarea = document.createElement("textarea")
        textarea.value = normalized
        textarea.setAttribute("readonly", "")
        textarea.style.position = "fixed"
        textarea.style.opacity = "0"
        textarea.style.pointerEvents = "none"
        document.body.appendChild(textarea)
        textarea.select()
        document.execCommand("copy")
        document.body.removeChild(textarea)
      }

      setCopied(true)
      if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current)
      feedbackTimerRef.current = setTimeout(() => setCopied(false), 1300)
    } catch {
      setCopied(false)
    }
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLSpanElement>) => {
    if (event.key !== "Enter" && event.key !== " ") return

    event.preventDefault()
    void copyImei()
  }

  const basePair = normalized.length > 4 ? normalized.slice(0, -4).slice(-2) : ""
  const lastFour = normalized.slice(-4)
  const prefix = normalized.length > 6 ? normalized.slice(0, -6) : ""
  const lastFourLabel = lastFour || normalized
  const ariaLabel = copyOnClick ? (copied ? "copiado" : "copiar") : `IMEI terminado en ${lastFourLabel}.`
  const title = copyOnClick ? (copied ? "Copiado" : "Copiar") : normalized
  const prefixRevealClass = prefix
    ? "group-hover:max-w-[20ch] group-hover:translate-x-0 group-hover:opacity-100 group-focus:max-w-[20ch] group-focus:translate-x-0 group-focus:opacity-100 group-focus-within:max-w-[20ch] group-focus-within:translate-x-0 group-focus-within:opacity-100"
    : ""
  const interactiveProps = copyOnClick
    ? {
        tabIndex: 0,
        role: "button",
        onClick: () => void copyImei(),
        onKeyDown: handleKeyDown,
      }
    : {}
  const interactiveClass = copyOnClick
    ? "cursor-pointer pr-0 transition-[padding-right] duration-200 group-hover:pr-4 group-focus:pr-4 group-focus-within:pr-4 group-data-[copied=true]:pr-12"
    : ""

  if (normalized.length <= 6) {
    return (
      <span
        aria-label={ariaLabel}
        title={title}
        data-copied={copied}
        className={`group inline-flex max-w-full items-baseline gap-0.5 overflow-visible font-mono tabular-nums whitespace-nowrap outline-none ${interactiveClass} ${className}`}
        {...interactiveProps}
      >
        {basePair ? <span className="font-normal opacity-75">{basePair}</span> : null}
        <span className="font-bold text-[1.05em] text-base-content">{lastFour}</span>
        {copyOnClick ? <CopyFeedback /> : null}
      </span>
    )
  }

  return (
    <span
      aria-label={ariaLabel}
      title={title}
      data-copied={copied}
      className={`group inline-flex max-w-full items-baseline overflow-visible font-mono tabular-nums whitespace-nowrap outline-none ${interactiveClass} ${className}`}
      {...interactiveProps}
    >
      <span className={`inline-block max-w-0 -translate-x-2 overflow-hidden opacity-0 transition-all duration-200 ease-out ${prefixRevealClass}`}>
        {prefix}
      </span>
      <span className="font-normal opacity-75">{basePair}</span>
      <span className="font-bold text-[1.05em] text-base-content">{lastFour}</span>
      {copyOnClick ? <CopyFeedback /> : null}
    </span>
  )
}
