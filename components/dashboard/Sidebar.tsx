"use client"
import { useState } from "react"
import Image from "next/image"
import clsx from "clsx"
import { useStore } from "@/lib/store"

// ── Nav items ──────────────────────────────────────────────────
const NAV_MAIN = [
  { id: "home",      label: "Home",       icon: HomeIcon },
  { id: "agents",    label: "Agents",     icon: AgentsIcon },
  { id: "instagram", label: "Instagram",  icon: InstagramIcon },
  { id: "projects",  label: "Projects",   icon: ProjectsIcon },
  { id: "journal",   label: "Journal",    icon: JournalIcon },
]

interface Props {
  activeTab: string
  onTabChange: (id: string) => void
}

export default function Sidebar({ activeTab, onTabChange }: Props) {
  const [expanded, setExpanded] = useState(false)
  const store = useStore()

  return (
    <>
      {/* ── Desktop sidebar ────────────────────────────────────── */}
      <aside
        className={clsx("sidebar-rail hidden lg:flex flex-col", expanded && "expanded")}
        onMouseEnter={() => setExpanded(true)}
        onMouseLeave={() => setExpanded(false)}
      >
        {/* Logo */}
        <div className="flex items-center h-14 px-4 border-b border-surface-border shrink-0">
          <div className="w-6 h-6 shrink-0 flex items-center justify-center overflow-hidden rounded-sm">
            <Image src="/logo.png" alt="HC" width={24} height={24} className="object-contain" />
          </div>
          {expanded && (
            <span className="ml-3 text-sm font-semibold text-ink-primary whitespace-nowrap overflow-hidden animate-fade-in">
              HeshamChina
            </span>
          )}
        </div>

        {/* Main nav */}
        <nav className="flex-1 py-3 overflow-y-auto overflow-x-hidden">
          {NAV_MAIN.map(item => {
            const isActive = activeTab === item.id
            const Icon = item.icon
            return (
              <button
                key={item.id}
                onClick={() => onTabChange(item.id)}
                data-tooltip={!expanded ? item.label : undefined}
                className={clsx("nav-item w-full text-left", isActive && "active")}
              >
                <span className="nav-icon">
                  <Icon active={isActive} />
                </span>
                {expanded && (
                  <span className="nav-label animate-fade-in">{item.label}</span>
                )}
              </button>
            )
          })}
        </nav>

        {/* Bottom: streak + settings */}
        <div className="px-3 py-3 border-t border-surface-border shrink-0 space-y-1">
          {/* Streak indicator */}
          <button
            onClick={() => onTabChange("home")}
            data-tooltip={!expanded ? `Streak: ${store.streaks.postingStreak}d` : undefined}
            className="nav-item w-full"
          >
            <span className="nav-icon text-sm">🔥</span>
            {expanded && (
              <span className="text-xs text-ink-muted animate-fade-in whitespace-nowrap">
                {store.streaks.postingStreak}d streak
              </span>
            )}
          </button>

          {/* Settings */}
          <button
            onClick={() => onTabChange("settings")}
            data-tooltip={!expanded ? "Settings" : undefined}
            className={clsx("nav-item w-full", activeTab === "settings" && "active")}
          >
            <span className="nav-icon">
              <SettingsIcon active={activeTab === "settings"} />
            </span>
            {expanded && (
              <span className="nav-label animate-fade-in">Settings</span>
            )}
          </button>
        </div>
      </aside>

      {/* ── Mobile bottom nav ──────────────────────────────────── */}
      <nav className="mobile-nav lg:hidden">
        {[...NAV_MAIN].map(item => {
          const isActive = activeTab === item.id
          const Icon = item.icon
          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className={clsx(
                "flex-1 flex flex-col items-center py-2.5 gap-0.5 transition-colors",
                isActive ? "text-brand-red" : "text-ink-muted"
              )}
            >
              <Icon active={isActive} />
              {isActive && <span className="w-3 h-0.5 bg-brand-red rounded-full mt-0.5" />}
            </button>
          )
        })}
      </nav>
    </>
  )
}

// ── SVG Icons ──────────────────────────────────────────────────
function HomeIcon({ active }: { active?: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={active ? 2 : 1.5} strokeLinecap="round" strokeLinejoin="round"
      className={active ? "text-brand-red" : "text-ink-muted"}>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  )
}

function AgentsIcon({ active }: { active?: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={active ? 2 : 1.5} strokeLinecap="round" strokeLinejoin="round"
      className={active ? "text-brand-red" : "text-ink-muted"}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
      <circle cx="18" cy="7" r="2.5" />
      <path d="M21 12c1.5 1 2 2.5 2 4" />
    </svg>
  )
}

function InstagramIcon({ active }: { active?: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={active ? 2 : 1.5} strokeLinecap="round" strokeLinejoin="round"
      className={active ? "text-brand-red" : "text-ink-muted"}>
      <rect x="2" y="2" width="20" height="20" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  )
}

function ProjectsIcon({ active }: { active?: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={active ? 2 : 1.5} strokeLinecap="round" strokeLinejoin="round"
      className={active ? "text-brand-red" : "text-ink-muted"}>
      <rect x="3" y="3" width="8" height="5" rx="1" />
      <rect x="13" y="3" width="8" height="5" rx="1" />
      <rect x="3" y="12" width="8" height="9" rx="1" />
      <rect x="13" y="12" width="8" height="4" rx="1" />
    </svg>
  )
}

function JournalIcon({ active }: { active?: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={active ? 2 : 1.5} strokeLinecap="round" strokeLinejoin="round"
      className={active ? "text-brand-red" : "text-ink-muted"}>
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
      <path d="M8 9h8M8 13h6" />
    </svg>
  )
}

function SettingsIcon({ active }: { active?: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={active ? 2 : 1.5} strokeLinecap="round" strokeLinejoin="round"
      className={active ? "text-brand-red" : "text-ink-muted"}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  )
}
