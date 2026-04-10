import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const state = await req.json()
    const errors: string[] = []

    const safe = async (label: string, fn: () => PromiseLike<any>) => {
      try { await fn() } catch (e: any) { errors.push(`${label}: ${e.message}`) }
    }

    // Deals
    if (state.deals?.length) {
      await safe("deals", () => supabase.from("deals").upsert(
        state.deals.map((d: any) => ({
          id: d.id, client: d.client, stream: d.stream, value: d.value,
          currency: d.currency, status: d.status, next_action: d.nextAction,
          contact_id: d.contactId ?? null, logs: d.logs ?? [],
          created_at: d.createdAt, updated_at: d.updatedAt,
        }))
      ))
    }

    // Projects
    if (state.projects?.length) {
      await safe("projects", () => supabase.from("projects").upsert(
        state.projects.map((p: any) => ({
          id: p.id, name: p.name, description: p.description, health: p.health,
          progress: p.progress, next_action: p.nextAction, due_date: p.dueDate ?? null,
          vercel_url: p.vercelUrl ?? null, live_url: p.liveUrl ?? null, tags: p.tags ?? [],
        }))
      ))
    }

    // Follower log
    if (state.followerLog?.length) {
      await safe("follower_log", () => supabase.from("follower_log").upsert(
        state.followerLog.map((e: any) => ({ date: e.date, ig: e.ig, x: e.x }))
      ))
    }

    // Content ideas
    if (state.contentIdeas?.length) {
      await safe("content_ideas", () => supabase.from("content_ideas").upsert(
        state.contentIdeas.map((i: any) => ({
          id: i.id, series: i.series, hook: i.hook, script: i.script,
          vibe: i.vibe, status: i.status, notes: i.notes,
          scheduled_date: i.scheduledDate ?? null, views_24h: i.views24h ?? null,
          views_7d: i.views7d ?? null, posted_at: i.postedAt ?? null, created_at: i.createdAt,
        }))
      ))
    }

    // Daily focus
    if (state.dailyFocus) {
      await safe("daily_focus", () => supabase.from("daily_focus").upsert({
        date: state.dailyFocus.date,
        main_mission: state.dailyFocus.mainMission,
        checklist: state.dailyFocus.checklist ?? [],
      }))
    }

    // Captures
    if (state.captures?.length) {
      await safe("captures", () => supabase.from("captures").upsert(
        state.captures.map((c: any) => ({
          id: c.id, text: c.text, processed: c.processed, created_at: c.createdAt,
        }))
      ))
    }

    // Weekly goals
    if (state.weeklyGoals?.length) {
      await safe("weekly_goals", () => supabase.from("weekly_goals").upsert(
        state.weeklyGoals.map((g: any) => ({
          id: g.id, text: g.text, progress: g.progress, week_start: g.weekStart,
        }))
      ))
    }

    // Streaks
    if (state.streaks) {
      await safe("streaks", () => supabase.from("streaks").upsert({
        id: "singleton",
        posting_streak: state.streaks.postingStreak,
        checkin_streak: state.streaks.checkinStreak,
        last_posted_date: state.streaks.lastPostedDate,
        last_checkin_date: state.streaks.lastCheckinDate,
      }))
    }

    // Affiliate links
    if (state.affiliateLinks?.length) {
      await safe("affiliate_links", () => supabase.from("affiliate_links").upsert(
        state.affiliateLinks.map((l: any) => ({
          id: l.id, title: l.title, url: l.url, category: l.category,
          commission: l.commission ?? null, created_at: l.createdAt,
        }))
      ))
    }

    // Revenue settings
    if (state.revenueSettings) {
      await safe("revenue_settings", () => supabase.from("revenue_settings").upsert({
        id: "singleton",
        monthly_target: state.revenueSettings.monthlyTarget,
        currency: state.revenueSettings.currency,
        stale_alert_days: state.revenueSettings.staleAlertDays,
      }))
    }

    // Contacts
    if (state.contacts?.length) {
      await safe("contacts", () => supabase.from("contacts").upsert(
        state.contacts.map((c: any) => ({
          id: c.id, name: c.name, type: c.type, company: c.company ?? null,
          wechat: c.wechat ?? null, whatsapp: c.whatsapp ?? null,
          email: c.email ?? null, country: c.country ?? null,
          notes: c.notes ?? [], tags: c.tags ?? [],
          last_contacted_at: c.lastContactedAt ?? null, created_at: c.createdAt,
        }))
      ))
    }

    // Journal entries
    if (state.journalEntries?.length) {
      await safe("journal_entries", () => supabase.from("journal_entries").upsert(
        state.journalEntries.map((j: any) => ({
          id: j.id, date: j.date, wins: j.wins, struggles: j.struggles,
          lessons: j.lessons, gratitude: j.gratitude,
          tomorrow_focus: j.tomorrowFocus, mood: j.mood,
        }))
      ))
    }

    // Expenses
    if (state.expenses?.length) {
      await safe("expenses", () => supabase.from("expenses").upsert(
        state.expenses.map((e: any) => ({
          id: e.id, description: e.description, amount: e.amount,
          currency: e.currency, category: e.category, date: e.date,
          deal_id: e.dealId ?? null, created_at: e.createdAt,
        }))
      ))
    }

    // Footage (base64 thumbnails skipped — only metadata migrated)
    if (state.footage?.length) {
      await safe("footage", () => supabase.from("footage").upsert(
        state.footage.map((f: any) => ({
          id: f.id, title: f.title, location: f.location ?? "", tag: f.tag,
          status: f.status, duration: f.duration ?? null, notes: f.notes ?? null,
          thumbnail_url: f.thumbnail?.startsWith("data:") ? null : (f.thumbnail ?? null),
          film_date: f.filmDate ?? null, linked_idea_id: f.linkedIdeaId ?? null,
          created_at: f.createdAt,
        }))
      ))
    }

    return NextResponse.json({
      ok: true,
      migrated: {
        deals: state.deals?.length ?? 0,
        projects: state.projects?.length ?? 0,
        contentIdeas: state.contentIdeas?.length ?? 0,
        contacts: state.contacts?.length ?? 0,
        journalEntries: state.journalEntries?.length ?? 0,
        expenses: state.expenses?.length ?? 0,
        footage: state.footage?.length ?? 0,
        captures: state.captures?.length ?? 0,
        weeklyGoals: state.weeklyGoals?.length ?? 0,
        affiliateLinks: state.affiliateLinks?.length ?? 0,
      },
      errors: errors.length > 0 ? errors : undefined,
    })
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 })
  }
}
