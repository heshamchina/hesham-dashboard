// ─── DEALS ────────────────────────────────────────────
export type DealStream = "sourcing" | "itinerary" | "markets"
export type DealStatus = "lead" | "negotiating" | "closed" | "paid"

export interface DealLog {
  id: string
  date: string
  note: string
}

export interface Deal {
  id: string
  client: string
  stream: DealStream
  value: number
  currency: string
  status: DealStatus
  nextAction: string
  contactId?: string        // link to contact
  logs: DealLog[]
  createdAt: string
  updatedAt: string
}

// ─── PROJECTS ─────────────────────────────────────────
export type ProjectHealth = "on-track" | "at-risk" | "blocked"

export interface Project {
  id: string
  name: string
  description: string
  health: ProjectHealth
  progress: number       // 0-100
  nextAction: string
  dueDate?: string
  vercelUrl?: string
  liveUrl?: string
  tags: string[]
}

// ─── SOCIAL ───────────────────────────────────────────
export interface FollowerEntry {
  date: string           // ISO date YYYY-MM-DD
  ig: number
  x: number
}

// ─── CONTENT PIPELINE ─────────────────────────────────
export type ContentSeries =
  | "city-series" | "chinese-brands" | "shopping"
  | "food-halal" | "advice" | "behind-scenes" | "other"

export type ContentVibe =
  | "viral" | "storytelling" | "informative"
  | "advice" | "behind-scenes" | "series-episode"

export type ContentStatus =
  | "idea" | "scripted" | "filmed" | "edited" | "posted"

export interface ContentIdea {
  id: string
  series: ContentSeries
  hook: string
  script: string
  vibe: ContentVibe
  status: ContentStatus
  notes: string
  scheduledDate?: string   // content calendar
  views24h?: number
  views7d?: number
  postedAt?: string
  createdAt: string
}

// ─── DAILY FOCUS ──────────────────────────────────────
export interface ChecklistItem {
  id: string
  text: string
  done: boolean
}

export interface DailyFocus {
  date: string           // YYYY-MM-DD
  mainMission: string
  checklist: ChecklistItem[]
}

// ─── QUICK CAPTURE ────────────────────────────────────
export interface CaptureItem {
  id: string
  text: string
  createdAt: string
  processed: boolean
}

// ─── WEEKLY GOALS ─────────────────────────────────────
export interface WeeklyGoal {
  id: string
  text: string
  progress: number       // 0-100
  weekStart: string      // ISO Monday date
}

// ─── STREAKS ──────────────────────────────────────────
export interface StreakData {
  postingStreak: number
  checkinStreak: number
  lastPostedDate: string
  lastCheckinDate: string
}

// ─── AFFILIATE LINKS ──────────────────────────────────
export type AffiliateCat = "hotel" | "flight" | "train" | "attraction" | "other"

export interface AffiliateLink {
  id: string
  title: string
  url: string
  category: AffiliateCat
  commission?: string
  createdAt: string
}

// ─── REVENUE SETTINGS ─────────────────────────────────
export interface RevenueSettings {
  monthlyTarget: number
  currency: string
  staleAlertDays: number
}

// ─── CONTACTS / MINI CRM ──────────────────────────────
export type ContactType = "client" | "supplier" | "collaborator" | "lead" | "other"

export interface ContactNote {
  id: string
  date: string
  text: string
}

export interface Contact {
  id: string
  name: string
  type: ContactType
  company?: string
  wechat?: string
  whatsapp?: string
  email?: string
  country?: string
  notes: ContactNote[]
  tags: string[]
  lastContactedAt?: string
  createdAt: string
}

// ─── JOURNAL ──────────────────────────────────────────
export interface JournalEntry {
  id: string
  date: string           // YYYY-MM-DD
  wins: string
  struggles: string
  lessons: string
  gratitude: string
  tomorrowFocus: string
  mood: 1 | 2 | 3 | 4 | 5   // 1=rough, 5=amazing
}

// ─── FOOTAGE VAULT ────────────────────────────────────
export type FootageTag =
  | "city-tour" | "food-halal" | "market" | "behind-scenes"
  | "product" | "nature" | "people" | "transport" | "other"

export type FootageStatus = "unused" | "scripted" | "posted"

export interface FootageClip {
  id: string
  title: string              // "Enshi canyon sunrise walk"
  location: string           // "Enshi, Hubei"
  tag: FootageTag
  status: FootageStatus
  duration?: string          // "0:45", "2:30"
  notes?: string             // anything they want to remember about it
  thumbnail?: string         // optional base64 screenshot
  filmDate?: string          // YYYY-MM-DD when filmed
  linkedIdeaId?: string      // if script was generated
  createdAt: string
}

// ─── EXPENSES ─────────────────────────────────────────
export type ExpenseCategory = "travel" | "tools" | "marketing" | "office" | "food" | "other"

export interface Expense {
  id: string
  description: string
  amount: number
  currency: string
  category: ExpenseCategory
  date: string
  dealId?: string        // optional link to deal
  createdAt: string
}
