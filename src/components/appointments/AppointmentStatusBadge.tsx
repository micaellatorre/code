"use client"

import type { AppointmentStatus } from "@prisma/client"
import { getStatusBadgeClass } from "./appointmentUtils"

export default function AppointmentStatusBadge({ status }: { status: AppointmentStatus }) {
  return <span className={`badge badge-outline ${getStatusBadgeClass(status)}`}>{status}</span>
}
