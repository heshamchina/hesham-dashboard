"use client"
import { useEffect, useRef } from "react"
import { useStore } from "./store"
import { db } from "./db"

export function useHydrate() {
  const hydrated = useRef(false)

  useEffect(() => {
    if (hydrated.current) return
    hydrated.current = true

    async function load() {
      try {
        const today = new Date().toISOString().split("T")[0]

        const [
          deals, projects, followerLog, contentIdeas,
          captures, weeklyGoals, affiliateLinks, contacts,
          journalEntries, expenses, footage,
          streaks, revenueSettings, dailyFocus,
        ] = await Promise.all([
          db.deals.fetchAll(),
          db.projects.fetchAll(),
          db.followerLog.fetchAll(),
          db.contentIdeas.fetchAll(),
          db.captures.fetchAll(),
          db.weeklyGoals.fetchAll(),
          db.affiliateLinks.fetchAll(),
          db.contacts.fetchAll(),
          db.journalEntries.fetchAll(),
          db.expenses.fetchAll(),
          db.footage.fetchAll(),
          db.streaks.fetch(),
          db.revenueSettings.fetch(),
          db.dailyFocus.fetchToday(today),
        ])

        const current = useStore.getState()

        useStore.setState({
          deals,
          projects,
          followerLog,
          contentIdeas,
          captures,
          weeklyGoals,
          affiliateLinks,
          contacts,
          journalEntries,
          expenses,
          footage,
          streaks:         streaks         ?? current.streaks,
          revenueSettings: revenueSettings ?? current.revenueSettings,
          dailyFocus:      dailyFocus      ?? current.dailyFocus,
        })

        console.log("✅ Loaded from Supabase")
      } catch (err) {
        console.warn("⚠️ Supabase unreachable — using localStorage cache", err)
      }
    }

    load()
  }, [])
}
