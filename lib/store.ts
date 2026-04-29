"use client"
import { create } from "zustand"
import { persist } from "zustand/middleware"
import { v4 as uuid } from "uuid"
import { db, debounced } from "./db"
import type {
  Deal, DealStatus, Project, ProjectHealth,
  FollowerEntry, ContentIdea, ContentStatus,
  DailyFocus, ChecklistItem, CaptureItem,
  WeeklyGoal, StreakData, AffiliateLink,
  RevenueSettings, Contact, ContactNote,
  JournalEntry, Expense, ExpenseCategory,
  FootageClip, FootageTag, FootageStatus,
  ClientRecord, ClientDiscussionMessage
} from "@/types"

const today = () => new Date().toISOString().split("T")[0]
const thisMonday = () => {
  const d = new Date()
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  return new Date(d.setDate(diff)).toISOString().split("T")[0]
}

export interface Store {
  deals: Deal[]
  addDeal: (d: Omit<Deal, "id" | "createdAt" | "updatedAt" | "logs">) => void
  updateDeal: (id: string, updates: Partial<Deal>) => void
  deleteDeal: (id: string) => void
  addDealLog: (id: string, note: string) => void
  setDealStatus: (id: string, status: DealStatus) => void

  revenueSettings: RevenueSettings
  setRevenueSettings: (s: Partial<RevenueSettings>) => void

  projects: Project[]
  addProject: (p: Omit<Project, "id">) => void
  updateProject: (id: string, updates: Partial<Project>) => void
  deleteProject: (id: string) => void

  followerLog: FollowerEntry[]
  logFollowers: (ig: number, x: number) => void

  contentIdeas: ContentIdea[]
  addIdea: (idea: Omit<ContentIdea, "id" | "createdAt">) => void
  updateIdea: (id: string, updates: Partial<ContentIdea>) => void
  deleteIdea: (id: string) => void
  setIdeaStatus: (id: string, status: ContentStatus) => void

  dailyFocus: DailyFocus | null
  setMainMission: (text: string) => void
  addChecklistItem: (text: string) => void
  toggleChecklistItem: (id: string) => void
  deleteChecklistItem: (id: string) => void
  resetDailyFocus: () => void

  captures: CaptureItem[]
  addCapture: (text: string) => void
  processCapture: (id: string) => void
  deleteCapture: (id: string) => void

  weeklyGoals: WeeklyGoal[]
  addWeeklyGoal: (text: string) => void
  updateGoalProgress: (id: string, progress: number) => void
  deleteWeeklyGoal: (id: string) => void

  streaks: StreakData
  markPostedToday: () => void
  markCheckinToday: () => void

  affiliateLinks: AffiliateLink[]
  addAffiliateLink: (link: Omit<AffiliateLink, "id" | "createdAt">) => void
  deleteAffiliateLink: (id: string) => void
  updateAffiliateLink: (id: string, updates: Partial<AffiliateLink>) => void

  contacts: Contact[]
  addContact: (c: Omit<Contact, "id" | "createdAt" | "notes">) => void
  updateContact: (id: string, updates: Partial<Contact>) => void
  deleteContact: (id: string) => void
  addContactNote: (id: string, text: string) => void

  journalEntries: JournalEntry[]
  saveJournalEntry: (entry: Omit<JournalEntry, "id">) => void
  deleteJournalEntry: (id: string) => void

  expenses: Expense[]
  addExpense: (e: Omit<Expense, "id" | "createdAt">) => void
  deleteExpense: (id: string) => void
  updateExpense: (id: string, updates: Partial<Expense>) => void

  footage: FootageClip[]
  addFootage: (f: Omit<FootageClip, "id" | "createdAt">) => void
  updateFootage: (id: string, updates: Partial<FootageClip>) => void
  deleteFootage: (id: string) => void

  clientRecords: ClientRecord[]
  addClientRecord: (c: Omit<ClientRecord, "id" | "createdAt" | "updatedAt" | "discussion">) => void
  updateClientRecord: (id: string, updates: Partial<ClientRecord>) => void
  deleteClientRecord: (id: string) => void
  addClientDiscussion: (id: string, msg: Omit<ClientDiscussionMessage, "id" | "date">) => void
  addClientProductPhoto: (id: string, photo: string) => void
  removeClientProductPhoto: (id: string, index: number) => void
}

export const useStore = create<Store>()(
  persist(
    (set, get) => ({

      // ── Deals ──────────────────────────────────────
      deals: [],
      addDeal: (d) => {
        const newDeal: Deal = { ...d, id: uuid(), logs: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
        set(s => ({ deals: [newDeal, ...s.deals] }))
        db.deals.upsert(newDeal)
      },
      updateDeal: (id, updates) => {
        set(s => ({ deals: s.deals.map(d => d.id === id ? { ...d, ...updates, updatedAt: new Date().toISOString() } : d) }))
        const updated = get().deals.find(d => d.id === id)
        if (updated) db.deals.upsert(updated)
      },
      deleteDeal: (id) => {
        set(s => ({ deals: s.deals.filter(d => d.id !== id) }))
        db.deals.delete(id)
      },
      addDealLog: (id, note) => {
        set(s => ({
          deals: s.deals.map(d => d.id === id ? {
            ...d, logs: [...d.logs, { id: uuid(), date: new Date().toISOString(), note }],
            updatedAt: new Date().toISOString()
          } : d)
        }))
        const updated = get().deals.find(d => d.id === id)
        if (updated) db.deals.upsert(updated)
      },
      setDealStatus: (id, status) => {
        set(s => ({ deals: s.deals.map(d => d.id === id ? { ...d, status, updatedAt: new Date().toISOString() } : d) }))
        const updated = get().deals.find(d => d.id === id)
        if (updated) db.deals.upsert(updated)
      },

      revenueSettings: { monthlyTarget: 3000, currency: "USD", staleAlertDays: 3 },
      setRevenueSettings: (s) => {
        set(st => ({ revenueSettings: { ...st.revenueSettings, ...s } }))
        debounced("revenueSettings", () => db.revenueSettings.upsert(get().revenueSettings))
      },

      // ── Projects ───────────────────────────────────
      projects: [
        { id: uuid(), name: "Sourcing OS", description: "SaaS platform for China→Arab sourcing", health: "on-track", progress: 60, nextAction: "Launch closed beta", liveUrl: "https://hesham-sourcing.vercel.app", tags: ["SaaS", "tech"] },
        { id: uuid(), name: "PhD Application", description: "UIBE Public Policy PhD 2026-2029", health: "on-track", progress: 80, nextAction: "Monitor CSC announcement", tags: ["education"] },
        { id: uuid(), name: "HeshamChina Tools", description: "Internal business tools suite", health: "on-track", progress: 75, nextAction: "Deploy dashboard to Vercel", tags: ["tech", "tools"] },
        { id: uuid(), name: "Content Calendar", description: "Instagram & X growth strategy", health: "at-risk", progress: 30, nextAction: "Post 3x this week", tags: ["content"] },
      ],
      addProject: (p) => {
        const newP = { ...p, id: uuid() }
        set(s => ({ projects: [newP, ...s.projects] }))
        db.projects.upsert(newP)
      },
      updateProject: (id, updates) => {
        set(s => ({ projects: s.projects.map(p => p.id === id ? { ...p, ...updates } : p) }))
        const updated = get().projects.find(p => p.id === id)
        if (updated) db.projects.upsert(updated)
      },
      deleteProject: (id) => {
        set(s => ({ projects: s.projects.filter(p => p.id !== id) }))
        db.projects.delete(id)
      },

      // ── Followers ──────────────────────────────────
      followerLog: [],
      logFollowers: (ig, x) => {
        const date = today()
        const entry: FollowerEntry = { date, ig, x }
        set(s => ({ followerLog: [...s.followerLog.filter(e => e.date !== date), entry].sort((a, b) => a.date.localeCompare(b.date)) }))
        db.followerLog.upsert(entry)
      },

      // ── Content ideas ──────────────────────────────
      contentIdeas: [],
      addIdea: (idea) => {
        const newIdea: ContentIdea = { ...idea, id: uuid(), createdAt: new Date().toISOString() }
        set(s => ({ contentIdeas: [newIdea, ...s.contentIdeas] }))
        db.contentIdeas.upsert(newIdea)
      },
      updateIdea: (id, updates) => {
        set(s => ({ contentIdeas: s.contentIdeas.map(i => i.id === id ? { ...i, ...updates } : i) }))
        const updated = get().contentIdeas.find(i => i.id === id)
        if (updated) debounced(`idea-${id}`, () => db.contentIdeas.upsert(updated))
      },
      deleteIdea: (id) => {
        set(s => ({ contentIdeas: s.contentIdeas.filter(i => i.id !== id) }))
        db.contentIdeas.delete(id)
      },
      setIdeaStatus: (id, status) => {
        set(s => ({ contentIdeas: s.contentIdeas.map(i => i.id === id ? { ...i, status } : i) }))
        const updated = get().contentIdeas.find(i => i.id === id)
        if (updated) db.contentIdeas.upsert(updated)
      },

      // ── Daily focus ────────────────────────────────
      dailyFocus: null,
      setMainMission: (text) => {
        set(s => ({
          dailyFocus: s.dailyFocus?.date === today()
            ? { ...s.dailyFocus, mainMission: text }
            : { date: today(), mainMission: text, checklist: [] }
        }))
        debounced("dailyFocus", () => { const f = get().dailyFocus; if (f) db.dailyFocus.upsert(f) })
      },
      addChecklistItem: (text) => {
        set(s => {
          const focus = s.dailyFocus?.date === today() ? s.dailyFocus : { date: today(), mainMission: "", checklist: [] }
          return { dailyFocus: { ...focus, checklist: [...focus.checklist, { id: uuid(), text, done: false }] } }
        })
        const f = get().dailyFocus; if (f) db.dailyFocus.upsert(f)
      },
      toggleChecklistItem: (id) => {
        set(s => ({
          dailyFocus: s.dailyFocus ? { ...s.dailyFocus, checklist: s.dailyFocus.checklist.map(i => i.id === id ? { ...i, done: !i.done } : i) } : null
        }))
        const f = get().dailyFocus; if (f) db.dailyFocus.upsert(f)
      },
      deleteChecklistItem: (id) => {
        set(s => ({
          dailyFocus: s.dailyFocus ? { ...s.dailyFocus, checklist: s.dailyFocus.checklist.filter(i => i.id !== id) } : null
        }))
        const f = get().dailyFocus; if (f) db.dailyFocus.upsert(f)
      },
      resetDailyFocus: () => {
        const f: DailyFocus = { date: today(), mainMission: "", checklist: [] }
        set({ dailyFocus: f })
        db.dailyFocus.upsert(f)
      },

      // ── Captures ───────────────────────────────────
      captures: [],
      addCapture: (text) => {
        const c: CaptureItem = { id: uuid(), text, createdAt: new Date().toISOString(), processed: false }
        set(s => ({ captures: [c, ...s.captures] }))
        db.captures.upsert(c)
      },
      processCapture: (id) => {
        set(s => ({ captures: s.captures.map(c => c.id === id ? { ...c, processed: true } : c) }))
        const updated = get().captures.find(c => c.id === id)
        if (updated) db.captures.upsert(updated)
      },
      deleteCapture: (id) => {
        set(s => ({ captures: s.captures.filter(c => c.id !== id) }))
        db.captures.delete(id)
      },

      // ── Weekly goals ───────────────────────────────
      weeklyGoals: [],
      addWeeklyGoal: (text) => {
        const g: WeeklyGoal = { id: uuid(), text, progress: 0, weekStart: thisMonday() }
        set(s => ({ weeklyGoals: [...s.weeklyGoals, g] }))
        db.weeklyGoals.upsert(g)
      },
      updateGoalProgress: (id, progress) => {
        set(s => ({ weeklyGoals: s.weeklyGoals.map(g => g.id === id ? { ...g, progress } : g) }))
        const updated = get().weeklyGoals.find(g => g.id === id)
        if (updated) debounced(`goal-${id}`, () => db.weeklyGoals.upsert(updated))
      },
      deleteWeeklyGoal: (id) => {
        set(s => ({ weeklyGoals: s.weeklyGoals.filter(g => g.id !== id) }))
        db.weeklyGoals.delete(id)
      },

      // ── Streaks ────────────────────────────────────
      streaks: { postingStreak: 0, checkinStreak: 0, lastPostedDate: "", lastCheckinDate: "" },
      markPostedToday: () => {
        const t = today()
        set(s => {
          if (s.streaks.lastPostedDate === t) return s
          const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0]
          const consecutive = s.streaks.lastPostedDate === yesterday
          const newStreaks = { ...s.streaks, postingStreak: consecutive ? s.streaks.postingStreak + 1 : 1, lastPostedDate: t }
          db.streaks.upsert(newStreaks)
          return { streaks: newStreaks }
        })
      },
      markCheckinToday: () => {
        const t = today()
        set(s => {
          if (s.streaks.lastCheckinDate === t) return s
          const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0]
          const consecutive = s.streaks.lastCheckinDate === yesterday
          const newStreaks = { ...s.streaks, checkinStreak: consecutive ? s.streaks.checkinStreak + 1 : 1, lastCheckinDate: t }
          db.streaks.upsert(newStreaks)
          return { streaks: newStreaks }
        })
      },

      // ── Affiliate links ────────────────────────────
      affiliateLinks: [],
      addAffiliateLink: (link) => {
        const newLink: AffiliateLink = { ...link, id: uuid(), createdAt: new Date().toISOString() }
        set(s => ({ affiliateLinks: [newLink, ...s.affiliateLinks] }))
        db.affiliateLinks.upsert(newLink)
      },
      deleteAffiliateLink: (id) => {
        set(s => ({ affiliateLinks: s.affiliateLinks.filter(l => l.id !== id) }))
        db.affiliateLinks.delete(id)
      },
      updateAffiliateLink: (id, updates) => {
        set(s => ({ affiliateLinks: s.affiliateLinks.map(l => l.id === id ? { ...l, ...updates } : l) }))
        const updated = get().affiliateLinks.find(l => l.id === id)
        if (updated) db.affiliateLinks.upsert(updated)
      },

      // ── Contacts ───────────────────────────────────
      contacts: [],
      addContact: (c) => {
        const newC: Contact = { ...c, id: uuid(), notes: [], createdAt: new Date().toISOString() }
        set(s => ({ contacts: [newC, ...s.contacts] }))
        db.contacts.upsert(newC)
      },
      updateContact: (id, updates) => {
        set(s => ({ contacts: s.contacts.map(c => c.id === id ? { ...c, ...updates } : c) }))
        const updated = get().contacts.find(c => c.id === id)
        if (updated) debounced(`contact-${id}`, () => db.contacts.upsert(updated))
      },
      deleteContact: (id) => {
        set(s => ({ contacts: s.contacts.filter(c => c.id !== id) }))
        db.contacts.delete(id)
      },
      addContactNote: (id, text) => {
        set(s => ({
          contacts: s.contacts.map(c => c.id === id ? {
            ...c,
            notes: [...c.notes, { id: uuid(), date: new Date().toISOString(), text }],
            lastContactedAt: new Date().toISOString()
          } : c)
        }))
        const updated = get().contacts.find(c => c.id === id)
        if (updated) db.contacts.upsert(updated)
      },

      // ── Journal ────────────────────────────────────
      journalEntries: [],
      saveJournalEntry: (entry) => {
        set(s => {
          const existing = s.journalEntries.find(e => e.date === entry.date)
          if (existing) {
            const updated = { ...entry, id: existing.id }
            debounced(`journal-${entry.date}`, () => db.journalEntries.upsert(updated))
            return { journalEntries: s.journalEntries.map(e => e.date === entry.date ? updated : e) }
          }
          const newEntry: JournalEntry = { ...entry, id: uuid() }
          db.journalEntries.upsert(newEntry)
          return { journalEntries: [newEntry, ...s.journalEntries] }
        })
      },
      deleteJournalEntry: (id) => {
        set(s => ({ journalEntries: s.journalEntries.filter(e => e.id !== id) }))
        db.journalEntries.delete(id)
      },

      // ── Expenses ───────────────────────────────────
      expenses: [],
      addExpense: (e) => {
        const newE: Expense = { ...e, id: uuid(), createdAt: new Date().toISOString() }
        set(s => ({ expenses: [newE, ...s.expenses] }))
        db.expenses.upsert(newE)
      },
      deleteExpense: (id) => {
        set(s => ({ expenses: s.expenses.filter(e => e.id !== id) }))
        db.expenses.delete(id)
      },
      updateExpense: (id, updates) => {
        set(s => ({ expenses: s.expenses.map(e => e.id === id ? { ...e, ...updates } : e) }))
        const updated = get().expenses.find(e => e.id === id)
        if (updated) db.expenses.upsert(updated)
      },

      // ── Footage vault ──────────────────────────────
      footage: [],
      addFootage: (f) => {
        const newF: FootageClip = { ...f, id: uuid(), createdAt: new Date().toISOString() }
        set(s => ({ footage: [newF, ...s.footage] }))
        db.footage.upsert(newF)
      },
      updateFootage: (id, updates) => {
        set(s => ({ footage: s.footage.map(f => f.id === id ? { ...f, ...updates } : f) }))
        const updated = get().footage.find(f => f.id === id)
        if (updated) db.footage.upsert(updated)
      },
      deleteFootage: (id) => {
        set(s => ({ footage: s.footage.filter(f => f.id !== id) }))
        db.footage.delete(id)
      },

      // ── Client Agent Hub ──────────────────────────
      clientRecords: [],
      addClientRecord: (c) => {
        const now = new Date().toISOString()
        const newClient: ClientRecord = {
          ...c,
          id: uuid(),
          discussion: [],
          createdAt: now,
          updatedAt: now,
        }
        set(s => ({ clientRecords: [newClient, ...s.clientRecords] }))
        db.clientRecords.upsert(newClient)
      },
      updateClientRecord: (id, updates) => {
        set(s => ({
          clientRecords: s.clientRecords.map(c => c.id === id ? { ...c, ...updates, updatedAt: new Date().toISOString() } : c)
        }))
        const updated = get().clientRecords.find(c => c.id === id)
        if (updated) debounced(`client-${id}`, () => db.clientRecords.upsert(updated))
      },
      deleteClientRecord: (id) => {
        set(s => ({ clientRecords: s.clientRecords.filter(c => c.id !== id) }))
        db.clientRecords.delete(id)
      },
      addClientDiscussion: (id, msg) => {
        set(s => ({
          clientRecords: s.clientRecords.map(c => c.id === id ? {
            ...c,
            discussion: [...c.discussion, { ...msg, id: uuid(), date: new Date().toISOString() }],
            updatedAt: new Date().toISOString(),
          } : c)
        }))
        const updated = get().clientRecords.find(c => c.id === id)
        if (updated) db.clientRecords.upsert(updated)
      },
      addClientProductPhoto: (id, photo) => {
        set(s => ({
          clientRecords: s.clientRecords.map(c => c.id === id ? {
            ...c,
            productPhotos: [photo, ...c.productPhotos],
            updatedAt: new Date().toISOString(),
          } : c)
        }))
        const updated = get().clientRecords.find(c => c.id === id)
        if (updated) db.clientRecords.upsert(updated)
      },
      removeClientProductPhoto: (id, index) => {
        set(s => ({
          clientRecords: s.clientRecords.map(c => c.id === id ? {
            ...c,
            productPhotos: c.productPhotos.filter((_, i) => i !== index),
            updatedAt: new Date().toISOString(),
          } : c)
        }))
        const updated = get().clientRecords.find(c => c.id === id)
        if (updated) db.clientRecords.upsert(updated)
      },
    }),
    { name: "heshamchina-dashboard-v2" }
  )
)
