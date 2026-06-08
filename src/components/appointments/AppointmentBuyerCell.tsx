"use client"

import Link from "next/link"
import type { AppointmentBuyerSummary } from "./types"

export default function AppointmentBuyerCell({ buyer }: { buyer: AppointmentBuyerSummary | null }) {
  if (!buyer) return <span className="text-base-content/50">Sin cliente</span>

  return (
    <div className="min-w-48">
      <Link href={`/dashboard/buyers/${buyer.id}/edit`} className="font-medium text-primary hover:underline">
        {buyer.name}
      </Link>
      <div className="mt-1 space-y-0.5 text-xs text-base-content/60">
        {buyer.phone ? <p>{buyer.phone}</p> : null}
        {buyer.instagram ? (
          <a
            href={`https://www.instagram.com/${buyer.instagram.replace(/^@/, "")}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            @{buyer.instagram.replace(/^@/, "")}
          </a>
        ) : null}
      </div>
    </div>
  )
}
