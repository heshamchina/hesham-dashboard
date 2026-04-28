import { NextRequest, NextResponse } from "next/server"

const APIFY_TOKEN = process.env.APIFY_API_TOKEN
const APIFY_BASE  = "https://api.apify.com/v2"

const ACTORS = {
  account:  "apify/instagram-scraper",
  hashtag:  "apify/instagram-hashtag-scraper",
  profile:  "apify/instagram-scraper",
}

// ── Input builders ────────────────────────────────────────────
function buildInput(targets: string[], type: "account" | "hashtag" | "profile") {
  if (type === "profile") {
    return {
      directUrls: targets.map(t =>
        t.startsWith("http") ? t : `https://www.instagram.com/${t.replace(/^@/, "")}/`
      ),
      resultsType: "details",   // profile-level data only — fast & cheap
      resultsLimit: 1,
      addParentData: false,
    }
  }
  if (type === "account") {
    return {
      directUrls: targets.map(t =>
        t.startsWith("http") ? t : `https://www.instagram.com/${t.replace(/^@/, "")}/`
      ),
      resultsType: "posts",
      resultsLimit: 12,
      addParentData: false,
      scrapePostsUntilDate: new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0],
    }
  }
  return {
    hashtags: targets.map(t => t.replace(/^#/, "")),
    resultsLimit: 20,
    resultsType: "posts",
  }
}

// ── Poll run until done or timeout ────────────────────────────
async function waitForRun(
  runId: string,
  maxMs = 60000,
  pollMs = 3000
): Promise<{ status: string; defaultDatasetId: string } | null> {
  const deadline = Date.now() + maxMs
  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, pollMs))
    const r = await fetch(`${APIFY_BASE}/actor-runs/${runId}?token=${APIFY_TOKEN}`)
    if (!r.ok) continue
    const d  = await r.json()
    const run = d.data
    if (run.status === "SUCCEEDED") return run
    if (["FAILED", "ABORTED", "TIMED-OUT"].includes(run.status)) return run
  }
  return null
}

// ── Fetch dataset items ───────────────────────────────────────
async function fetchDataset(datasetId: string, limit = 100): Promise<any[]> {
  const r = await fetch(
    `${APIFY_BASE}/datasets/${datasetId}/items?token=${APIFY_TOKEN}&limit=${limit}&clean=true`,
    { signal: AbortSignal.timeout(15000) }
  )
  if (!r.ok) return []
  return r.json()
}

// ── Main handler ──────────────────────────────────────────────
export async function POST(req: NextRequest) {
  if (!APIFY_TOKEN) {
    return NextResponse.json({ error: "APIFY_API_TOKEN not configured" }, { status: 503 })
  }

  try {
    const { targets, type = "account" } = await req.json()

    if (!targets?.length) {
      return NextResponse.json({ error: "targets array is required" }, { status: 400 })
    }
    if (!["account", "hashtag", "profile"].includes(type)) {
      return NextResponse.json({ error: "type must be 'account', 'hashtag', or 'profile'" }, { status: 400 })
    }

    const actorId = type === "hashtag" ? ACTORS.hashtag : ACTORS.account
    const input   = buildInput(targets, type as "account" | "hashtag" | "profile")

    // Start the actor run
    const startRes = await fetch(
      `${APIFY_BASE}/acts/${encodeURIComponent(actorId)}/runs?token=${APIFY_TOKEN}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
        signal: AbortSignal.timeout(15000),
      }
    )

    if (!startRes.ok) {
      const err = await startRes.text()
      return NextResponse.json({ error: `Apify start failed: ${err}` }, { status: 502 })
    }

    const startData = await startRes.json()
    const runId: string = startData.data?.id

    if (!runId) {
      return NextResponse.json({ error: "No run ID returned from Apify" }, { status: 502 })
    }

    // Poll until done (max 90s for profile, 60s otherwise)
    const timeoutMs = type === "profile" ? 90000 : 60000
    const run = await waitForRun(runId, timeoutMs)

    if (!run) {
      return NextResponse.json({ error: "Apify run timed out", runId, partial: true }, { status: 202 })
    }
    if (run.status !== "SUCCEEDED") {
      return NextResponse.json({ error: `Apify run ended with status: ${run.status}`, runId }, { status: 502 })
    }

    const items = await fetchDataset(run.defaultDatasetId)

    // ── For profile type: extract follower stats ──────────────
    if (type === "profile") {
      const profile = items[0] ?? {}
      const followers = profile.followersCount ?? profile.followers ?? null
      const following  = profile.followsCount  ?? profile.following  ?? null
      const posts      = profile.postsCount    ?? profile.posts      ?? null
      const username   = profile.username ?? targets[0]

      return NextResponse.json({
        ok: true,
        type: "profile",
        username,
        followers,
        following,
        posts,
        scrapedAt: new Date().toISOString(),
        runId,
      })
    }

    return NextResponse.json({
      ok: true,
      type,
      targets,
      runId,
      count: items.length,
      items,
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
