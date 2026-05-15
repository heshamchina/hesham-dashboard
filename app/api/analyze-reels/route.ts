import { NextRequest, NextResponse } from "next/server"
import OpenAI from "openai"

const openai  = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
const APIFY_TOKEN = process.env.APIFY_API_TOKEN
const APIFY_BASE  = "https://api.apify.com/v2"

// ── Apify helpers ─────────────────────────────────────────────

async function startApifyRun(input: object): Promise<string | null> {
  const res = await fetch(
    `${APIFY_BASE}/acts/apify~instagram-scraper/runs?token=${APIFY_TOKEN}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
      signal: AbortSignal.timeout(15000),
    }
  )
  if (!res.ok) return null
  const d = await res.json()
  return d.data?.id ?? null
}

async function waitForRun(runId: string, maxMs = 90000): Promise<string | null> {
  const deadline = Date.now() + maxMs
  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, 4000))
    const r = await fetch(`${APIFY_BASE}/actor-runs/${runId}?token=${APIFY_TOKEN}`)
    if (!r.ok) continue
    const run = (await r.json()).data
    if (run.status === "SUCCEEDED") return run.defaultDatasetId
    if (["FAILED", "ABORTED", "TIMED-OUT"].includes(run.status)) return null
  }
  return null
}

async function fetchDataset(datasetId: string, limit = 50): Promise<any[]> {
  const r = await fetch(
    `${APIFY_BASE}/datasets/${datasetId}/items?token=${APIFY_TOKEN}&limit=${limit}&clean=true`,
    { signal: AbortSignal.timeout(15000) }
  )
  if (!r.ok) return []
  return r.json()
}

// ── Extract hook from caption (first sentence / first line) ───

function extractHook(caption: string | undefined): string {
  if (!caption) return ""
  const first = caption.split(/\n/)[0]?.trim() || ""
  return first.length > 120 ? first.slice(0, 120) + "…" : first
}

// ── Normalise a scraped post item ─────────────────────────────

function normalisePost(item: any) {
  return {
    shortCode:    item.shortCode   ?? item.id ?? "",
    url:          item.url         ?? `https://www.instagram.com/p/${item.shortCode ?? ""}`,
    type:         item.type        ?? item.productType ?? "GraphVideo",
    views:        item.videoViewCount ?? item.playCount  ?? item.videoPlayCount ?? 0,
    likes:        item.likesCount  ?? item.likeCount    ?? 0,
    comments:     item.commentsCount ?? item.commentCount ?? 0,
    timestamp:    item.timestamp   ?? item.takenAtTimestamp ?? "",
    caption:      item.caption     ?? item.text ?? "",
    hook:         extractHook(item.caption ?? item.text),
    hashtags:     (item.hashtags   ?? []).map((h: any) => typeof h === "string" ? h : h.name ?? ""),
    thumbnail:    item.displayUrl  ?? item.thumbnailUrl ?? "",
    duration:     item.videoDuration ?? null,
  }
}

// ── GPT-4o pattern analysis ───────────────────────────────────

async function analyseWithAI(handle: string, posts: ReturnType<typeof normalisePost>[]) {
  const topByViews = [...posts]
    .filter(p => p.views > 0)
    .sort((a, b) => b.views - a.views)
    .slice(0, 15)

  const postsContext = topByViews.map((p, i) =>
    `#${i + 1} — Views: ${p.views.toLocaleString()} | Likes: ${p.likes} | Date: ${p.timestamp?.split("T")[0] ?? "?"}\n` +
    `Hook: "${p.hook}"\n` +
    `Hashtags: ${p.hashtags.slice(0, 6).join(" ") || "none"}\n` +
    `Type: ${p.type} | Duration: ${p.duration ? `${p.duration}s` : "?"}`
  ).join("\n\n")

  const allHooks = posts.map(p => p.hook).filter(Boolean)
  const avgViews = posts.reduce((s, p) => s + p.views, 0) / (posts.length || 1)

  const prompt = `You are analyzing Instagram account @${handle} for content creator @heshaminchina (Jordanian, 7 years in China, 32K Arabic followers covering cities/food/markets/life in China).

== REAL SCRAPED DATA — ${posts.length} posts ==
Average views per post: ${Math.round(avgViews).toLocaleString()}

TOP POSTS (by views):
${postsContext}

ALL HOOKS from recent posts:
${allHooks.slice(0, 20).map((h, i) => `${i + 1}. "${h}"`).join("\n")}

Analyze this data and return JSON only (no markdown):
{
  "accountSnapshot": {
    "avgViews": ${Math.round(avgViews)},
    "totalPostsAnalyzed": ${posts.length},
    "topPostViews": ${topByViews[0]?.views ?? 0},
    "bestDay": "day of week their top posts were published — from the data",
    "avgDuration": "average reel duration from data or unknown",
    "contentBreakdown": "% breakdown of content types (city tours, food, advice, etc.) from the hooks"
  },
  "hookPatterns": {
    "mostUsedFormats": ["hook format 1 that appears in top posts", "format 2", "format 3"],
    "bestHook": "the single best hook from their data verbatim",
    "hookFormula": "the reusable formula behind their top hooks (e.g. 'Question + surprising answer in China')",
    "avoidHooks": "what hook style consistently underperforms based on data"
  },
  "topTopics": [
    {
      "topic": "topic name",
      "avgViews": 0,
      "examples": ["example post hook 1", "example 2"],
      "why": "why this topic performs well"
    }
  ],
  "contentGaps": [
    {
      "gap": "topic or format they're missing",
      "opportunity": "specific angle Hesham can own"
    }
  ],
  "stealableIdeas": [
    {
      "inspiration": "what their successful post did",
      "heshamVersion": "how Hesham does it better / differently",
      "hook": "hook Hesham should use",
      "series": "city-series|food-halal|shopping|chinese-brands|advice|behind-scenes|other",
      "estimatedViralScore": 8
    }
  ],
  "strategicSummary": "2-3 sentences: the single most important thing Hesham can learn from this account, backed by real numbers"
}`

  const res = await openai.chat.completions.create({
    model: "gpt-4o",
    max_tokens: 2000,
    temperature: 0.3,
    messages: [{ role: "user", content: prompt }],
  })

  const text = res.choices[0].message.content || "{}"
  return JSON.parse(text.replace(/```json|```/g, "").trim())
}

// ── Main handler ──────────────────────────────────────────────

export async function POST(req: NextRequest) {
  if (!APIFY_TOKEN) return NextResponse.json({ error: "APIFY_API_TOKEN not configured" }, { status: 503 })

  try {
    const { handle, type = "account", hashtag } = await req.json()

    // ── HASHTAG mode ─────────────────────────────────────────
    if (type === "hashtag") {
      const tag = (hashtag ?? handle ?? "").replace(/^#/, "").trim()
      if (!tag) return NextResponse.json({ error: "hashtag required" }, { status: 400 })

      const runId = await startApifyRun({
        hashtags: [tag],
        resultsLimit: 25,
        resultsType: "posts",
      })
      if (!runId) return NextResponse.json({ error: "Failed to start Apify run" }, { status: 502 })

      const datasetId = await waitForRun(runId, 90000)
      if (!datasetId) return NextResponse.json({ error: "Apify timed out" }, { status: 202 })

      const raw = await fetchDataset(datasetId, 25)
      const posts = raw.map(normalisePost).sort((a, b) => b.views - a.views)

      return NextResponse.json({
        ok: true,
        type: "hashtag",
        hashtag: `#${tag}`,
        count: posts.length,
        posts,
        topPost: posts[0] ?? null,
        avgViews: Math.round(posts.reduce((s, p) => s + p.views, 0) / (posts.length || 1)),
      })
    }

    // ── ACCOUNT mode ─────────────────────────────────────────
    const cleanHandle = (handle ?? "").replace(/^@/, "").trim()
    if (!cleanHandle) return NextResponse.json({ error: "handle required" }, { status: 400 })

    const runId = await startApifyRun({
      directUrls: [`https://www.instagram.com/${cleanHandle}/`],
      resultsType: "posts",
      resultsLimit: 30,
      addParentData: false,
    })
    if (!runId) return NextResponse.json({ error: "Failed to start Apify run" }, { status: 502 })

    const datasetId = await waitForRun(runId, 90000)
    if (!datasetId) return NextResponse.json({ error: "Apify timed out — Instagram may be blocking" }, { status: 202 })

    const raw = await fetchDataset(datasetId, 30)
    if (!raw.length) return NextResponse.json({ error: "No posts found — account may be private" }, { status: 404 })

    const posts = raw.map(normalisePost).sort((a, b) => b.views - a.views)
    const analysis = await analyseWithAI(cleanHandle, posts)

    return NextResponse.json({
      ok: true,
      type: "account",
      handle: cleanHandle,
      count: posts.length,
      posts,
      analysis,
      scrapedAt: new Date().toISOString(),
    })

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
