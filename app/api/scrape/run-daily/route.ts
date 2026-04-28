import { NextRequest, NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"

const MY_ACCOUNT = "heshaminchina"

// ── Internal scrape call ──────────────────────────────────────
async function scrapeInstagram(
  targets: string[],
  type: "account" | "hashtag" | "profile"
): Promise<{ items: any[]; profile?: any; error?: string }> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
  try {
    const r = await fetch(`${baseUrl}/api/scrape/instagram`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targets, type }),
      signal: AbortSignal.timeout(120000),
    })
    const d = await r.json()
    if (!r.ok) return { items: [], error: d.error }
    if (type === "profile") return { items: [], profile: d }
    return { items: d.items || [] }
  } catch (e: any) {
    return { items: [], error: e.message }
  }
}

// ── Save batch to scrape_results ──────────────────────────────
async function saveResults(type: "account" | "hashtag", target: string, data: any[]) {
  if (!data.length) return
  await supabase.from("scrape_results").insert({
    type, target, data,
    scraped_at: new Date().toISOString(),
  })
}

// ── Summarise for Ziad ────────────────────────────────────────
function summariseForZiad(
  myPosts: any[],
  competitorResults: { target: string; items: any[] }[],
  hashtagResults:    { target: string; items: any[] }[]
): string {
  const parts: string[] = []

  if (myPosts.length) {
    const rows = myPosts.slice(0, 12).map(p => {
      const likes    = p.likesCount ?? p.likes ?? 0
      const comments = p.commentsCount ?? p.comments ?? 0
      const type     = p.type ?? p.mediaType ?? "unknown"
      const caption  = (p.caption ?? p.text ?? "").slice(0, 80)
      const date     = (p.timestamp ?? p.takenAt ?? "").slice(0, 10)
      return `  [${date}] ${type.toUpperCase()} — ${likes.toLocaleString()} likes, ${comments} comments | "${caption}"`
    })
    parts.push(`MY ACCOUNT (@heshaminchina) — last ${rows.length} posts:\n${rows.join("\n")}`)
  }

  for (const { target, items } of competitorResults) {
    if (!items.length) continue
    const top = [...items].sort((a, b) => (b.likesCount ?? 0) - (a.likesCount ?? 0)).slice(0, 5)
    const rows = top.map(p => {
      const likes   = p.likesCount ?? 0
      const type    = p.type ?? p.mediaType ?? "unknown"
      const caption = (p.caption ?? "").slice(0, 80)
      return `  ${type.toUpperCase()} — ${likes.toLocaleString()} likes | "${caption}"`
    })
    parts.push(`COMPETITOR @${target} — top 5 posts:\n${rows.join("\n")}`)
  }

  for (const { target, items } of hashtagResults) {
    if (!items.length) continue
    const top = [...items].sort((a, b) => (b.likesCount ?? 0) - (a.likesCount ?? 0)).slice(0, 10)
    const avgLikes  = Math.round(top.reduce((s, p) => s + (p.likesCount ?? 0), 0) / top.length)
    const topCaptions = top.slice(0, 3).map(p => `"${(p.caption ?? "").slice(0, 60)}"`)
    parts.push(`HASHTAG #${target} — top posts avg ${avgLikes.toLocaleString()} likes | samples: ${topCaptions.join(", ")}`)
  }

  return parts.join("\n\n")
}

// ── Main handler ──────────────────────────────────────────────
export async function POST(req: NextRequest) {
  // Optional CRON_SECRET guard
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    const auth = req.headers.get("authorization")
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
  }

  const log: string[]    = []
  const errors: string[] = []

  try {
    // ── Step 1: Scrape @heshaminchina profile for follower count ──
    log.push("Scraping @heshaminchina profile...")
    const { profile, error: profileErr } = await scrapeInstagram([MY_ACCOUNT], "profile")

    let followersCount: number | null = null

    if (profileErr || !profile) {
      errors.push(`profile scrape: ${profileErr ?? "no data"}`)
      log.push("  ⚠ profile scrape failed, skipping follower_log insert")
    } else {
      followersCount = profile.followers ?? null
      log.push(`  → followers: ${followersCount?.toLocaleString() ?? "unknown"}`)
    }

    // ── Step 2: Insert into follower_log if not already today ─────
    if (followersCount !== null) {
      const today = new Date().toISOString().split("T")[0]

      const { data: existing } = await supabase
        .from("follower_log")
        .select("id")
        .eq("date", today)
        .maybeSingle()

      if (existing) {
        log.push(`  → follower_log already has an entry for ${today}, skipping`)
      } else {
        const { error: insertErr } = await supabase.from("follower_log").insert({
          date: today,
          ig: followersCount,
          x: null,
        })
        if (insertErr) {
          errors.push(`follower_log insert: ${insertErr.message}`)
        } else {
          log.push(`  → follower_log inserted: ${today} / ${followersCount.toLocaleString()} followers`)
        }
      }
    }

    // ── Step 3: Load scrape targets ───────────────────────────────
    const { data: configRows } = await supabase
      .from("scrape_config")
      .select("*")
      .eq("active", true)

    const competitorTargets: string[] = (configRows || [])
      .filter((r: any) => r.type === "account")
      .map((r: any) => r.target)

    const hashtagTargets: string[] = (configRows || [])
      .filter((r: any) => r.type === "hashtag")
      .map((r: any) => r.target)

    log.push(`Config loaded: ${competitorTargets.length} competitors, ${hashtagTargets.length} hashtags`)

    // ── Step 4: Scrape my account posts (for Ziad analysis) ───────
    log.push("Scraping @heshaminchina posts...")
    const { items: myPosts, error: myErr } = await scrapeInstagram([MY_ACCOUNT], "account")
    if (myErr) {
      errors.push(`my account posts: ${myErr}`)
    } else {
      await saveResults("account", MY_ACCOUNT, myPosts)
      log.push(`  → ${myPosts.length} posts saved`)
    }

    // ── Step 5: Scrape competitors ────────────────────────────────
    const competitorResults: { target: string; items: any[] }[] = []
    for (const target of competitorTargets) {
      log.push(`Scraping competitor @${target}...`)
      const { items, error } = await scrapeInstagram([target], "account")
      if (error) {
        errors.push(`competitor @${target}: ${error}`)
      } else {
        await saveResults("account", target, items)
        log.push(`  → ${items.length} posts saved`)
        competitorResults.push({ target, items })
      }
    }

    // ── Step 6: Scrape hashtags ───────────────────────────────────
    const hashtagResults: { target: string; items: any[] }[] = []
    if (hashtagTargets.length) {
      log.push(`Scraping ${hashtagTargets.length} hashtags...`)
      const { items: htItems, error: htErr } = await scrapeInstagram(hashtagTargets, "hashtag")
      if (htErr) {
        errors.push(`hashtags: ${htErr}`)
      } else {
        for (const target of hashtagTargets) {
          const matching = htItems.filter(
            (p: any) => (p.hashtags ?? []).some((h: string) =>
              h.toLowerCase() === target.toLowerCase()
            ) || (p.url ?? "").includes(target.toLowerCase())
          )
          const toSave = matching.length ? matching : htItems
          await saveResults("hashtag", target, toSave)
          hashtagResults.push({ target, items: toSave })
        }
        log.push(`  → ${htItems.length} hashtag posts saved`)
      }
    }

    // ── Step 7: Call Ziad with fresh scraped data ─────────────────
    const scrapedSummary = summariseForZiad(
      myErr ? [] : myPosts,
      competitorResults,
      hashtagResults
    )
    log.push("Calling Ziad with fresh data...")

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
    const ziadRes = await fetch(`${baseUrl}/api/agents/ziad`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: "Analyze my Instagram performance vs competitors and surface content opportunities",
        scrapedData: scrapedSummary,
      }),
      signal: AbortSignal.timeout(30000),
    })

    const ziadData = ziadRes.ok ? await ziadRes.json() : null
    if (ziadData?.output) {
      log.push("Ziad analysis saved.")
    } else {
      errors.push("Ziad call failed or returned no output")
    }

    return NextResponse.json({
      ok: true,
      log,
      errors: errors.length ? errors : undefined,
      followersLogged: followersCount,
      ziadTaskId: ziadData?.taskId ?? null,
      summary: {
        followersCount,
        myPostsCount: myErr ? 0 : myPosts.length,
        competitorsScraped: competitorResults.length,
        hashtagsScraped: hashtagResults.length,
      },
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error"
    return NextResponse.json({ ok: false, error: msg, log }, { status: 500 })
  }
}
