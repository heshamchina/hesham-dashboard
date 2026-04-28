"use client"
import { useState, useEffect } from "react"
import { useStore } from "@/lib/store"
import { useHydrate } from "@/lib/useHydrate"
import Sidebar from "@/components/dashboard/Sidebar"
import CompanyHQ from "@/components/dashboard/CompanyHQ"
import AgentsPage from "@/components/dashboard/AgentsPage"
import InstagramSuite from "@/components/dashboard/InstagramSuite"
import ProjectsHub from "@/components/dashboard/ProjectsHub"
import Journal from "@/components/dashboard/Journal"
import SettingsPage from "@/components/dashboard/SettingsPage"

export type TabId = "home" | "agents" | "instagram" | "projects" | "journal" | "settings"

export default function Dashboard() {
  useHydrate()
  const store = useStore()
  const [tab, setTab] = useState<TabId>("home")
  const [weather, setWeather] = useState<{
    temp: string | number
    emoji: string
    description: string
  } | null>(null)

  useEffect(() => {
    store.markCheckinToday()
    fetch("/api/weather")
      .then(r => r.json())
      .then(setWeather)
      .catch(() => {})
  }, [])

  function navigate(id: string) {
    setTab(id as TabId)
  }

  return (
    <div className="surface-base min-h-screen pb-16 lg:pb-0">
      <Sidebar activeTab={tab} onTabChange={navigate} />

      <div className="lg:pl-14">
        <main className="w-full max-w-5xl mx-auto p-4 lg:p-8 min-h-screen">

          {tab === "home"      && <CompanyHQ onNavigate={navigate} weather={weather} />}
          {tab === "agents"    && <AgentsPage onNavigate={navigate} />}
          {tab === "instagram" && <InstagramSuite />}
          {tab === "projects"  && <ProjectsHub />}
          {tab === "journal"   && <Journal />}
          {tab === "settings"  && <SettingsPage />}

        </main>
      </div>

      {/* Floating quick capture */}
      <button
        onClick={() => {
          const t = prompt("Quick capture:")
          if (t?.trim()) store.addCapture(t.trim())
        }}
        title="Quick capture"
        aria-label="Quick capture idea"
        className="fixed bottom-20 right-4 lg:bottom-8 lg:right-8 flex items-center justify-center text-xl z-30 transition-all hover:scale-110 active:scale-95"
        style={{
          width: 44,
          height: 44,
          background: "#D4A017",
          borderRadius: 10,
          boxShadow: "0 4px 20px rgba(212,160,23,0.4)",
          color: "#0F0F0F",
          fontWeight: 700,
        }}
      >
        +
      </button>
    </div>
  )
}
