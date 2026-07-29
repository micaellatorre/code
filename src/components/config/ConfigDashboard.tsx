"use client"

import { useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import type { ComponentType, SVGProps } from "react"
import { Cog6ToothIcon, RectangleStackIcon, UserGroupIcon, UserPlusIcon } from "@heroicons/react/24/outline"
import SettingsTab from "@/components/config/SettingsTab"
import CatalogsTab from "@/components/config/CatalogsTab"
import TeamTab from "@/components/config/TeamTab"
import type { ConfigTabKey } from "@/components/config/types"
import type { UsersDashboardData } from "@/lib/domain/users-dashboard"

const tabs: { key: ConfigTabKey; label: string; icon: ComponentType<SVGProps<SVGSVGElement>> }[] = [
  { key: "ajustes", label: "Ajustes", icon: Cog6ToothIcon },
  { key: "catalogos", label: "Catalogos", icon: RectangleStackIcon },
  { key: "equipo", label: "Mi equipo", icon: UserGroupIcon },
]

function normalizeTab(value: string | null): ConfigTabKey {
  if (value === "catalogos" || value === "equipo") return value
  return "ajustes"
}

export default function ConfigDashboard({ team }: { team: UsersDashboardData }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const activeTab = normalizeTab(searchParams.get("tab"))
  const [inviteNonce, setInviteNonce] = useState(0)

  function setTab(tab: ConfigTabKey) {
    router.replace(`/dashboard/config?tab=${tab}`, { scroll: false })
  }

  return (
    <div className="space-y-4 sm:p-4">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-bold">Configuracion</h1>
          <p className="text-sm text-base-content/60">Ajustes administrativos del tenant, catalogos operativos y equipo.</p>
        </div>
        {activeTab === "equipo" ? (
          <button type="button" className="btn btn-primary btn-sm sm:mt-1" onClick={() => setInviteNonce((value) => value + 1)}>
            <UserPlusIcon className="size-4" />
            Generar invitacion
          </button>
        ) : null}
      </header>

      <div role="tablist" className="tabs tabs-boxed w-fit max-w-full overflow-x-auto">
        {tabs.map((tab) => {
          const Icon = tab.icon
          return (
            <button
              key={tab.key}
              type="button"
              role="tab"
              className={`tab gap-2 ${activeTab === tab.key ? "tab-active" : ""}`}
              onClick={() => setTab(tab.key)}
            >
              <Icon className="size-4" />
              {tab.label}
            </button>
          )
        })}
      </div>

      {activeTab === "ajustes" ? <SettingsTab /> : null}
      {activeTab === "catalogos" ? <CatalogsTab /> : null}
      {activeTab === "equipo" ? <TeamTab team={team} inviteNonce={inviteNonce} /> : null}
    </div>
  )
}
