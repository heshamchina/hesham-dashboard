import { NextRequest, NextResponse } from "next/server"
import OpenAI from "openai"
import { supabase } from "@/lib/supabase"
import { AGENT_MAP } from "@/lib/agents"

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
const agent = AGENT_MAP.ziad

// ── Live RSS + search (fallback when no scraped data) ─────────────────────────
async function fetchLiveSignals(query: string): Promise<string> {
  const UA = "Mozilla/5.0 (compatible; HeshamChinaDashboard/1.0)"
  const fetchSafe = async (url: string) => {
    try {
      const r = await fetch(url, {
        headers: { "User-Agent": UA },
        signal: AbortSignal.timeout(6000),
      })
      return r.ok ? await r.text() : ""
    } catch { return "" }
  }

  const serperKey = process.env.SERPER_API_KEY
  let googleSnippets = ""
  if (serperKey) {
    try {
      const r = await fetch("https://google.serper.dev/search", {
        method: "POST",
        headers: { "X-API-KEY": serperKey, "Content-Type": "application/json" },
        body: JSON.stringify({ q: `${query} China trending 2024 2025`, gl: "cn", num: 8 }),
        signal: AbortSignal.timeout(7000),
      })
      if (r.ok) {
        const d = await r.json()
        googleSnippets = (d.organic || [])
          .map((r: any) => `[${r.title}] ${r.snippet}`)
          .slice(0, 8)
          .join("\n")
      }
    } catch {}
  }

  const rssUrls = [
    "https://www.sixthtone.com/feed",
    "https://www.scmp.com/rss/5/feed",
    "https://www.chinadaily.com.cn/rss/china_rss.xml",
  ]
  const rssTexts = await Promise.all(rssUrls.map(fetchSafe))
  const rssContent = rssTexts
    .join("\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .slice(0, 3000)

  return [googleSnippets, rssContent].filter(Boolean).join("\n\n---\n\n")
}

// ── Build user content block depending on data mode ──────────────────────────
function buildUserContent(
  query: string,
  scrapedData: string | null,
  liveSignals: string
): string {
  if (scrapedData) {
    // Real Apify data mode — deep competitive analysis
    return `
You have fresh real Instagram data. Analyze it like a strategist, not a reporter.

REAL SCRAPED DATA:
${scrapedData}

Deliver a sharp competitive intelligence report:

1. PERFORMANCE PATTERNS — What content types/formats are performing best for @heshaminchina right now? What's underperforming? Be specific (Reels vs Carousels vs Photos, which topics get most engagement).

2. COMPETITOR GAPS — What are competitors doing that @heshaminchina is NOT? Look for formats, topics, posting patterns, hooks, content series. Call out specific examples from the data.

3. TRENDING HASHTAGS — Which hashtags in the data show high engagement? Which are oversaturated (lots of posts but low average likes)?

4. WHAT'S DYING — Flag any content type or topic showing declining engagement. Don't let Hesham waste time there.

5. FIVE SPECIFIC CONTENT RECOMMENDATIONS — Each must be:
   - Grounded in the actual data (cite what you saw)
   - Specific enough to film this week
   - Include the content format, angle, and why it will work NOW
   - Rated by effort vs impact (low/med/high)

Be direct. Skip anything generic. If the data is too thin to conclude something, say so.
`.trim()
  }

  // Fallback: live signals mode
  return `
Query: "${query}"

LIVE DATA FROM FEEDS & SEARCH:
${liveSignals || "(no live data — reason from your knowledge)"}

Assess what's actually trending or worth covering right now for an Arab content creator based in China.
Filter hard — only surface things with real signal or clear first-mover opportunity.
For each trend: name it, rate signal strength (🔥 hot / ⚡ emerging / 🧊 cooling), explain why it matters NOW, give a specific content angle for @heshaminchina.
If something is dead or generic, say so and skip it.

End with 5 specific content recommendations this week.
`.trim()
}

// ── Main handler ──────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const {
      query = "China content trends for Arab creators",
      scrapedData,   // string: pre-summarised Apify data from run-daily, or raw caller data
      sessionId,
    } = await req.json()

    // Only fetch live signals if no scraped data provided
    const liveSignals = scrapedData ? "" : await fetchLiveSignals(query)

    const userContent = buildUserContent(
      query,
      scrapedData || null,
      liveSignals
    )

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      max_tokens: scrapedData ? 1000 : 700,  // more tokens for real data analysis
      temperature: 0.7,
      messages: [
        { role: "system", content: agent.systemPrompt },
        { role: "user", content: userContent },
      ],
    })

    const output = completion.choices[0].message.content || ""

    const { data: task } = await supabase
      .from("agent_tasks")
      .insert({
        agent_id: agent.id,
        agent_name: agent.name,
        task_type: agent.taskType,
        input: userContent,
        output,
        session_id: sessionId || null,
        status: "done",
      })
      .select("id")
      .single()

    return NextResponse.json({ output, taskId: task?.id || null })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
