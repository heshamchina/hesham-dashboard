import { supabase } from "./supabase"
import type {
  Deal, Project, FollowerEntry, ContentIdea, DailyFocus,
  CaptureItem, WeeklyGoal, StreakData, AffiliateLink, RevenueSettings,
  Contact, JournalEntry, Expense, FootageClip, ClientRecord
} from "@/types"

// ── debounce helper ────────────────────────────────────────────────────────
const timers = new Map<string, ReturnType<typeof setTimeout>>()
export function debounced(key: string, fn: () => void, ms = 600) {
  clearTimeout(timers.get(key))
  timers.set(key, setTimeout(fn, ms))
}

// ── row mappers ────────────────────────────────────────────────────────────
const toDeal = (r: any): Deal => ({
  id: r.id, client: r.client, stream: r.stream,
  value: Number(r.value), currency: r.currency, status: r.status,
  nextAction: r.next_action, contactId: r.contact_id ?? undefined,
  logs: r.logs ?? [], createdAt: r.created_at, updatedAt: r.updated_at,
})
const fromDeal = (d: Deal) => ({
  id: d.id, client: d.client, stream: d.stream,
  value: d.value, currency: d.currency, status: d.status,
  next_action: d.nextAction, contact_id: d.contactId ?? null,
  logs: d.logs, created_at: d.createdAt, updated_at: d.updatedAt,
})

const toProject = (r: any): Project => ({
  id: r.id, name: r.name, description: r.description,
  health: r.health, progress: r.progress, nextAction: r.next_action,
  dueDate: r.due_date ?? undefined, vercelUrl: r.vercel_url ?? undefined,
  liveUrl: r.live_url ?? undefined, tags: r.tags ?? [],
})
const fromProject = (p: Project) => ({
  id: p.id, name: p.name, description: p.description,
  health: p.health, progress: p.progress, next_action: p.nextAction,
  due_date: p.dueDate ?? null, vercel_url: p.vercelUrl ?? null,
  live_url: p.liveUrl ?? null, tags: p.tags,
})

const toIdea = (r: any): ContentIdea => ({
  id: r.id, series: r.series, hook: r.hook, script: r.script,
  vibe: r.vibe, status: r.status, notes: r.notes,
  scheduledDate: r.scheduled_date ?? undefined,
  views24h: r.views_24h ?? undefined, views7d: r.views_7d ?? undefined,
  postedAt: r.posted_at ?? undefined, createdAt: r.created_at,
})
const fromIdea = (i: ContentIdea) => ({
  id: i.id, series: i.series, hook: i.hook, script: i.script,
  vibe: i.vibe, status: i.status, notes: i.notes,
  scheduled_date: i.scheduledDate ?? null,
  views_24h: i.views24h ?? null, views_7d: i.views7d ?? null,
  posted_at: i.postedAt ?? null, created_at: i.createdAt,
})

const toContact = (r: any): Contact => ({
  id: r.id, name: r.name, type: r.type, company: r.company ?? undefined,
  wechat: r.wechat ?? undefined, whatsapp: r.whatsapp ?? undefined,
  email: r.email ?? undefined, country: r.country ?? undefined,
  notes: r.notes ?? [], tags: r.tags ?? [],
  lastContactedAt: r.last_contacted_at ?? undefined, createdAt: r.created_at,
})
const fromContact = (c: Contact) => ({
  id: c.id, name: c.name, type: c.type, company: c.company ?? null,
  wechat: c.wechat ?? null, whatsapp: c.whatsapp ?? null,
  email: c.email ?? null, country: c.country ?? null,
  notes: c.notes, tags: c.tags,
  last_contacted_at: c.lastContactedAt ?? null, created_at: c.createdAt,
})

const toJournal = (r: any): JournalEntry => ({
  id: r.id, date: r.date, wins: r.wins, struggles: r.struggles,
  lessons: r.lessons, gratitude: r.gratitude,
  tomorrowFocus: r.tomorrow_focus, mood: r.mood,
})
const fromJournal = (j: JournalEntry) => ({
  id: j.id, date: j.date, wins: j.wins, struggles: j.struggles,
  lessons: j.lessons, gratitude: j.gratitude,
  tomorrow_focus: j.tomorrowFocus, mood: j.mood,
})

const toExpense = (r: any): Expense => ({
  id: r.id, description: r.description, amount: Number(r.amount),
  currency: r.currency, category: r.category, date: r.date,
  dealId: r.deal_id ?? undefined, createdAt: r.created_at,
})
const fromExpense = (e: Expense) => ({
  id: e.id, description: e.description, amount: e.amount,
  currency: e.currency, category: e.category, date: e.date,
  deal_id: e.dealId ?? null, created_at: e.createdAt,
})

const toFootage = (r: any): FootageClip => ({
  id: r.id, title: r.title, location: r.location, tag: r.tag,
  status: r.status, duration: r.duration ?? undefined,
  notes: r.notes ?? undefined, thumbnail: r.thumbnail_url ?? undefined,
  filmDate: r.film_date ?? undefined, linkedIdeaId: r.linked_idea_id ?? undefined,
  createdAt: r.created_at,
})
const fromFootage = (f: FootageClip) => ({
  id: f.id, title: f.title, location: f.location, tag: f.tag,
  status: f.status, duration: f.duration ?? null,
  notes: f.notes ?? null, thumbnail_url: f.thumbnail?.startsWith("data:") ? null : (f.thumbnail ?? null),
  film_date: f.filmDate ?? null, linked_idea_id: f.linkedIdeaId ?? null,
  created_at: f.createdAt,
})

const toClientRecord = (r: any): ClientRecord => ({
  id: r.id,
  name: r.name,
  contactInfo: r.contact_info,
  whatsapp: r.whatsapp ?? undefined,
  industry: r.industry,
  productsWanted: r.products_wanted ?? [],
  productPhotos: r.product_photos ?? [],
  managerName: r.manager_name,
  managerField: r.manager_field,
  status: r.status,
  discussion: r.discussion ?? [],
  createdAt: r.created_at,
  updatedAt: r.updated_at,
})

const fromClientRecord = (c: ClientRecord) => ({
  id: c.id,
  name: c.name,
  contact_info: c.contactInfo,
  whatsapp: c.whatsapp ?? null,
  industry: c.industry,
  products_wanted: c.productsWanted,
  product_photos: c.productPhotos,
  manager_name: c.managerName,
  manager_field: c.managerField,
  status: c.status,
  discussion: c.discussion,
  created_at: c.createdAt,
  updated_at: c.updatedAt,
})

// ── db object ──────────────────────────────────────────────────────────────
export const db = {

  deals: {
    async fetchAll(): Promise<Deal[]> {
      const { data } = await supabase.from("deals").select("*").order("created_at", { ascending: false })
      return (data ?? []).map(toDeal)
    },
    async upsert(d: Deal) {
      await supabase.from("deals").upsert(fromDeal(d))
    },
    async delete(id: string) {
      await supabase.from("deals").delete().eq("id", id)
    },
  },

  projects: {
    async fetchAll(): Promise<Project[]> {
      const { data } = await supabase.from("projects").select("*")
      return (data ?? []).map(toProject)
    },
    async upsert(p: Project) {
      await supabase.from("projects").upsert(fromProject(p))
    },
    async delete(id: string) {
      await supabase.from("projects").delete().eq("id", id)
    },
  },

  followerLog: {
    async fetchAll(): Promise<FollowerEntry[]> {
      const { data } = await supabase.from("follower_log").select("*").order("date")
      return (data ?? []).map(r => ({ date: r.date, ig: r.ig, x: r.x }))
    },
    async upsert(e: FollowerEntry) {
      await supabase.from("follower_log").upsert({ date: e.date, ig: e.ig, x: e.x })
    },
  },

  contentIdeas: {
    async fetchAll(): Promise<ContentIdea[]> {
      const { data } = await supabase.from("content_ideas").select("*").order("created_at", { ascending: false })
      return (data ?? []).map(toIdea)
    },
    async upsert(i: ContentIdea) {
      await supabase.from("content_ideas").upsert(fromIdea(i))
    },
    async delete(id: string) {
      await supabase.from("content_ideas").delete().eq("id", id)
    },
  },

  dailyFocus: {
    async fetchToday(date: string): Promise<DailyFocus | null> {
      const { data } = await supabase.from("daily_focus").select("*").eq("date", date).single()
      if (!data) return null
      return { date: data.date, mainMission: data.main_mission, checklist: data.checklist ?? [] }
    },
    async upsert(f: DailyFocus) {
      await supabase.from("daily_focus").upsert({
        date: f.date, main_mission: f.mainMission, checklist: f.checklist,
      })
    },
  },

  captures: {
    async fetchAll(): Promise<CaptureItem[]> {
      const { data } = await supabase.from("captures").select("*").order("created_at", { ascending: false })
      return (data ?? []).map(r => ({ id: r.id, text: r.text, processed: r.processed, createdAt: r.created_at }))
    },
    async upsert(c: CaptureItem) {
      await supabase.from("captures").upsert({ id: c.id, text: c.text, processed: c.processed, created_at: c.createdAt })
    },
    async delete(id: string) {
      await supabase.from("captures").delete().eq("id", id)
    },
  },

  weeklyGoals: {
    async fetchAll(): Promise<WeeklyGoal[]> {
      const { data } = await supabase.from("weekly_goals").select("*")
      return (data ?? []).map(r => ({ id: r.id, text: r.text, progress: r.progress, weekStart: r.week_start }))
    },
    async upsert(g: WeeklyGoal) {
      await supabase.from("weekly_goals").upsert({ id: g.id, text: g.text, progress: g.progress, week_start: g.weekStart })
    },
    async delete(id: string) {
      await supabase.from("weekly_goals").delete().eq("id", id)
    },
  },

  streaks: {
    async fetch(): Promise<StreakData | null> {
      const { data } = await supabase.from("streaks").select("*").eq("id", "singleton").single()
      if (!data) return null
      return {
        postingStreak: data.posting_streak, checkinStreak: data.checkin_streak,
        lastPostedDate: data.last_posted_date, lastCheckinDate: data.last_checkin_date,
      }
    },
    async upsert(s: StreakData) {
      await supabase.from("streaks").upsert({
        id: "singleton", posting_streak: s.postingStreak, checkin_streak: s.checkinStreak,
        last_posted_date: s.lastPostedDate, last_checkin_date: s.lastCheckinDate,
      })
    },
  },

  affiliateLinks: {
    async fetchAll(): Promise<AffiliateLink[]> {
      const { data } = await supabase.from("affiliate_links").select("*").order("created_at", { ascending: false })
      return (data ?? []).map(r => ({ id: r.id, title: r.title, url: r.url, category: r.category, commission: r.commission ?? undefined, createdAt: r.created_at }))
    },
    async upsert(l: AffiliateLink) {
      await supabase.from("affiliate_links").upsert({ id: l.id, title: l.title, url: l.url, category: l.category, commission: l.commission ?? null, created_at: l.createdAt })
    },
    async delete(id: string) {
      await supabase.from("affiliate_links").delete().eq("id", id)
    },
  },

  revenueSettings: {
    async fetch(): Promise<RevenueSettings | null> {
      const { data } = await supabase.from("revenue_settings").select("*").eq("id", "singleton").single()
      if (!data) return null
      return { monthlyTarget: Number(data.monthly_target), currency: data.currency, staleAlertDays: data.stale_alert_days }
    },
    async upsert(s: RevenueSettings) {
      await supabase.from("revenue_settings").upsert({ id: "singleton", monthly_target: s.monthlyTarget, currency: s.currency, stale_alert_days: s.staleAlertDays })
    },
  },

  contacts: {
    async fetchAll(): Promise<Contact[]> {
      const { data } = await supabase.from("contacts").select("*").order("created_at", { ascending: false })
      return (data ?? []).map(toContact)
    },
    async upsert(c: Contact) {
      await supabase.from("contacts").upsert(fromContact(c))
    },
    async delete(id: string) {
      await supabase.from("contacts").delete().eq("id", id)
    },
  },

  journalEntries: {
    async fetchAll(): Promise<JournalEntry[]> {
      const { data } = await supabase.from("journal_entries").select("*").order("date", { ascending: false })
      return (data ?? []).map(toJournal)
    },
    async upsert(j: JournalEntry) {
      await supabase.from("journal_entries").upsert(fromJournal(j))
    },
    async delete(id: string) {
      await supabase.from("journal_entries").delete().eq("id", id)
    },
  },

  expenses: {
    async fetchAll(): Promise<Expense[]> {
      const { data } = await supabase.from("expenses").select("*").order("created_at", { ascending: false })
      return (data ?? []).map(toExpense)
    },
    async upsert(e: Expense) {
      await supabase.from("expenses").upsert(fromExpense(e))
    },
    async delete(id: string) {
      await supabase.from("expenses").delete().eq("id", id)
    },
  },

  footage: {
    async fetchAll(): Promise<FootageClip[]> {
      const { data } = await supabase.from("footage").select("*").order("created_at", { ascending: false })
      return (data ?? []).map(toFootage)
    },
    async upsert(f: FootageClip) {
      await supabase.from("footage").upsert(fromFootage(f))
    },
    async delete(id: string) {
      await supabase.from("footage").delete().eq("id", id)
    },
    async uploadThumbnail(file: File, clipId: string): Promise<string> {
      const ext = file.name.split(".").pop() || "jpg"
      const path = `${clipId}.${ext}`
      const { error } = await supabase.storage.from("thumbnails").upload(path, file, { upsert: true })
      if (error) throw error
      const { data } = supabase.storage.from("thumbnails").getPublicUrl(path)
      return data.publicUrl
    },
  },

  clientRecords: {
    async fetchAll(): Promise<ClientRecord[]> {
      const { data } = await supabase.from("client_records").select("*").order("updated_at", { ascending: false })
      return (data ?? []).map(toClientRecord)
    },
    async upsert(c: ClientRecord) {
      await supabase.from("client_records").upsert(fromClientRecord(c))
    },
    async delete(id: string) {
      await supabase.from("client_records").delete().eq("id", id)
    },
    async uploadProductPhoto(file: File, clientId: string): Promise<string> {
      const ext = file.name.split(".").pop() || "jpg"
      const path = `${clientId}/${crypto.randomUUID()}.${ext}`
      const { error } = await supabase.storage.from("client-products").upload(path, file, { upsert: false })
      if (error) throw error
      const { data } = supabase.storage.from("client-products").getPublicUrl(path)
      return data.publicUrl
    },
  },
}
