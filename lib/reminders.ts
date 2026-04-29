import type { ClientRecord, ContentIdea, Deal, Project, CaptureItem, FootageClip, RevenueSettings } from "@/types"

export type ReminderPriority = "high" | "medium" | "low"

export interface DashboardReminder {
  id: string
  title: string
  detail: string
  priority: ReminderPriority
  tab: "home" | "agents" | "instagram" | "projects" | "journal" | "settings"
  kind: "deal" | "client" | "content" | "project" | "capture" | "footage"
}

interface ReminderInput {
  deals: Deal[]
  revenueSettings: RevenueSettings
  clients: ClientRecord[]
  ideas: ContentIdea[]
  projects: Project[]
  captures: CaptureItem[]
  footage: FootageClip[]
}

export function buildDashboardReminders(input: ReminderInput): DashboardReminder[] {
  const reminders: DashboardReminder[] = []

  const staleDeals = input.deals.filter(d => {
    if (d.status === "paid") return false
    const days = (Date.now() - new Date(d.updatedAt).getTime()) / 86400000
    return days >= input.revenueSettings.staleAlertDays
  })
  if (staleDeals.length > 0) {
    reminders.push({
      id: "stale-deals",
      title: `${staleDeals.length} stale deals need follow-up`,
      detail: staleDeals.slice(0, 2).map(d => d.client).join(", "),
      priority: "high",
      tab: "home",
      kind: "deal",
    })
  }

  const pendingClients = input.clients.filter(c => c.status === "pending")
  if (pendingClients.length > 0) {
    reminders.push({
      id: "pending-clients",
      title: `${pendingClients.length} clients are pending`,
      detail: pendingClients.slice(0, 2).map(c => c.name).join(", "),
      priority: "high",
      tab: "agents",
      kind: "client",
    })
  }

  const noRecentClientLog = input.clients.filter(c => {
    const days = (Date.now() - new Date(c.updatedAt).getTime()) / 86400000
    return c.status !== "closed" && days >= 5
  })
  if (noRecentClientLog.length > 0) {
    reminders.push({
      id: "inactive-clients",
      title: `${noRecentClientLog.length} clients have no recent updates`,
      detail: "Open client logs and add next step notes",
      priority: "medium",
      tab: "agents",
      kind: "client",
    })
  }

  const oldIdeas = input.ideas.filter(i => {
    if (i.status !== "idea") return false
    const days = (Date.now() - new Date(i.createdAt).getTime()) / 86400000
    return days >= 4
  })
  if (oldIdeas.length > 0) {
    reminders.push({
      id: "old-ideas",
      title: `${oldIdeas.length} content ideas not progressed`,
      detail: "Move ideas to scripted or delete weak ones",
      priority: "medium",
      tab: "instagram",
      kind: "content",
    })
  }

  const atRiskProjects = input.projects.filter(p => p.health === "at-risk" || p.health === "blocked")
  if (atRiskProjects.length > 0) {
    reminders.push({
      id: "risk-projects",
      title: `${atRiskProjects.length} projects need intervention`,
      detail: atRiskProjects.slice(0, 2).map(p => p.name).join(", "),
      priority: "medium",
      tab: "projects",
      kind: "project",
    })
  }

  const pendingCaptures = input.captures.filter(c => !c.processed)
  if (pendingCaptures.length >= 3) {
    reminders.push({
      id: "capture-backlog",
      title: `${pendingCaptures.length} captured notes pending review`,
      detail: "Process quick captures into tasks or ideas",
      priority: "low",
      tab: "home",
      kind: "capture",
    })
  }

  const unusedFootage = input.footage.filter(f => f.status === "unused")
  if (unusedFootage.length > 0) {
    reminders.push({
      id: "unused-footage",
      title: `${unusedFootage.length} footage clips are ready to monetize`,
      detail: "Generate scripts and schedule this week",
      priority: "low",
      tab: "instagram",
      kind: "footage",
    })
  }

  const rank: Record<ReminderPriority, number> = { high: 0, medium: 1, low: 2 }
  return reminders.sort((a, b) => rank[a.priority] - rank[b.priority])
}
