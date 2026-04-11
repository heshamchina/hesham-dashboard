import { NextRequest, NextResponse } from "next/server"
import OpenAI from "openai"

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
const UA = "Mozilla/5.0 (compatible; HeshamChinaDashboard/1.0)"

async function fetchWithTimeout(url: string, opts: RequestInit = {}, ms = 6000): Promise<Response | null> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), ms)
  try {
    const res = await fetch(url, { ...opts, signal: controller.signal, headers: { "User-Agent": UA, ...opts.headers } })
    return res.ok ? res : null
  } catch { return null } finally { clearTimeout(timer) }
}

function parseRSS(xml: string, label: string, maxItems = 7): string {
  const items: string[] = []
  const itemRegex = /<item>([\s\S]*?)<\/item>/g
  let match
  while ((match = itemRegex.exec(xml)) !== null && items.length < maxItems) {
    const block = match[1]
    const title = (/<title><!\[CDATA\[(.*?)\]\]><\/title>/.exec(block) || /<title>(.*?)<\/title>/.exec(block))?.[1]?.trim()
    const desc = (/<description><!\[CDATA\[(.*?)\]\]><\/description>/.exec(block) || /<description>(.*?)<\/description>/.exec(block))?.[1]
      ?.replace(/<[^>]+>/g, "")?.trim()?.slice(0, 180)
    const pubDate = (/<pubDate>(.*?)<\/pubDate>/.exec(block))?.[1]?.trim()
    if (title) items.push(`[${label}] ${title}${desc ? ` — ${desc}` : ""}${pubDate ? ` (${pubDate})` : ""}`)
  }
  return items.join("\n")
}

// ── SOURCES: What's happening IN China ────────────────────────────────────
// Focus: cities, lifestyle, youth trends, food, travel, events, apps, markets
const SOURCES = {

  // China lifestyle, culture, what's trending among Chinese youth
  lifestyle: [
    { url: "https://www.sixthtone.com/feed",                       label: "Sixth Tone" },        // best source for Chinese youth/culture
    { url: "https://www.globaltimes.cn/rss/outbrain.xml",          label: "Global Times" },
    { url: "https://www.chinadaily.com.cn/rss/china_rss.xml",      label: "China Daily" },
  ],

  // Travel, cities, destinations going viral, check-in spots
  travel: [
    { url: "https://www.chinadaily.com.cn/rss/travel_rss.xml",     label: "China Daily Travel" },
    { url: "https://www.scmp.com/rss/2/feed",                      label: "SCMP China" },
    { url: "https://www.globaltimes.cn/rss/outbrain.xml",          label: "Global Times" },
    { url: "https://www.sixthtone.com/feed",                       label: "Sixth Tone" },
  ],

  // Economy, consumer trends, new brands, cheap finds, markets
  consumer: [
    { url: "https://www.scmp.com/rss/11/feed",                     label: "SCMP Economy" },
    { url: "https://www.chinadaily.com.cn/rss/bizchina_rss.xml",   label: "China Daily Biz" },
    { url: "https://www.sixthtone.com/feed",                       label: "Sixth Tone" },
    { url: "https://www.globaltimes.cn/rss/outbrain.xml",          label: "Global Times" },
  ],

  // Tech, apps, gadgets going viral in China
  tech: [
    { url: "https://www.scmp.com/rss/4/feed",                      label: "SCMP Tech" },
    { url: "https://www.chinadaily.com.cn/rss/china_rss.xml",      label: "China Daily" },
    { url: "https://www.globaltimes.cn/rss/outbrain.xml",          label: "Global Times" },
  ],

  // Sourcing, trade, wholesale for Arab buyers
  trade: [
    { url: "https://www.globaltimes.cn/rss/outbrain.xml",          label: "Global Times" },
    { url: "https://www.chinadaily.com.cn/rss/bizchina_rss.xml",   label: "China Daily Biz" },
    { url: "https://www.scmp.com/rss/4/feed",                      label: "SCMP Business" },
  ],

  // Halal, Muslim life in China, Ramadan
  halal: [
    { url: "https://feeds.bbci.co.uk/news/world/middle_east/rss.xml", label: "BBC Middle East" },
    { url: "https://www.chinadaily.com.cn/rss/china_rss.xml",      label: "China Daily" },
    { url: "https://www.sixthtone.com/feed",                       label: "Sixth Tone" },
  ],
}

const FOCUS_MAP: Record<string, (keyof typeof SOURCES)[]> = {
  all:      ["lifestyle", "travel", "consumer", "tech"],
  china:    ["lifestyle", "travel", "consumer", "tech"],
  business: ["trade", "consumer", "tech"],
  travel:   ["travel", "lifestyle"],
  trending: ["lifestyle", "consumer", "tech", "travel"],
  ramadan:  ["halal", "travel", "lifestyle"],
}

// Serper: search for what's actually viral/trending IN China right now
async function serperTrendSearch(focus: string): Promise<string[]> {
  const key = process.env.SERPER_API_KEY
  if (!key) return []

  const queryMap: Record<string, string> = {
    all:      "China trending viral 2025 city travel food market youth",
    china:    "China viral trend 2025 places food lifestyle",
    business: "China wholesale market cheap finds 2025 Canton Fair sourcing",
    travel:   "China city viral check-in destination 2025 trending tourism",
    trending: "China trending viral Xiaohongshu Douyin 2025 youth culture",
    ramadan:  "China halal Muslim food Ramadan 2025 mosque city",
  }

  const q = queryMap[focus] || queryMap.all

  try {
    const [engRes, cnRes] = await Promise.allSettled([
      fetchWithTimeout("https://google.serper.dev/search", {
        method: "POST",
        headers: { "X-API-KEY": key, "Content-Type": "application/json" },
        body: JSON.stringify({ q, num: 6, gl: "cn", hl: "en" })
      }),
      fetchWithTimeout("https://google.serper.dev/search", {
        method: "POST",
        headers: { "X-API-KEY": key, "Content-Type": "application/json" },
        body: JSON.stringify({ q: `中国 最新 流行 ${focus === "travel" ? "旅游打卡" : focus === "ramadan" ? "清真 斋月" : "生活方式 2025"}`, num: 5, gl: "cn", hl: "zh-cn" })
      })
    ])

    const results: string[] = []
    if (engRes.status === "fulfilled" && engRes.value) {
      const d = await engRes.value.json()
      ;(d.organic || []).slice(0, 6).forEach((r: any) => results.push(`[Google EN] ${r.title} — ${r.snippet}`))
    }
    if (cnRes.status === "fulfilled" && cnRes.value) {
      const d = await cnRes.value.json()
      ;(d.organic || []).slice(0, 4).forEach((r: any) => results.push(`[Google CN] ${r.title} — ${r.snippet}`))
    }
    return results
  } catch { return [] }
}

export async function POST(req: NextRequest) {
  try {
    const { focus = "all", date = new Date().toISOString().split("T")[0] } = await req.json()

    const sourceKeys = FOCUS_MAP[focus] || FOCUS_MAP.all
    const sourcesToFetch = sourceKeys.flatMap(k => SOURCES[k])

    // Deduplicate by URL
    const seen = new Set<string>()
    const uniqueSources = sourcesToFetch.filter(s => { if (seen.has(s.url)) return false; seen.add(s.url); return true })

    // Fetch all RSS + Serper in parallel
    const [fetchResults, serperResults] = await Promise.all([
      Promise.allSettled(uniqueSources.map(async (src) => {
        const raw = await fetchWithTimeout(src.url, {}, 5500)
        if (!raw) return { label: src.label, items: "" }
        const xml = await raw.text()
        return { label: src.label, items: parseRSS(xml, src.label, 7) }
      })),
      serperTrendSearch(focus),
    ])

    const newsLines: string[] = []
    const successfulSources: string[] = []

    for (const result of fetchResults) {
      if (result.status === "fulfilled" && result.value.items) {
        newsLines.push(result.value.items)
        successfulSources.push(result.value.label)
      }
    }
    if (serperResults.length > 0) {
      newsLines.push(`=== Google Search (China trends) ===\n${serperResults.join("\n")}`)
      successfulSources.push("Google Search")
    }

    const hasRealData = newsLines.length > 0
    const newsContext = newsLines.join("\n\n")

    const focusLabel: Record<string, string> = {
      all:      "everything happening in China",
      china:    "China lifestyle, cities, culture",
      business: "wholesale, sourcing, markets, cheap finds",
      travel:   "cities, check-in spots, viral destinations",
      trending: "what's viral right now — Xiaohongshu, Douyin, youth trends",
      ramadan:  "halal food, Muslim life, Ramadan in China",
    }

    const systemPrompt = `You are a content strategist for @heshaminchina — a Jordanian creator living in Beijing, 7+ years in China, 80+ cities visited, 32K Arabic Instagram followers.

His content niche: **Everything happening in China** — cities, food, markets, festivals, apps, cheap finds, viral spots, youth culture, life hacks, exhibitions, nature, urban life, weird/cool discoveries.

His audience: Arabs who are curious about China — some travel there, some do business, some just love his content.

Your job: Turn the news/trends below into content ideas that would make an Arab audience say "I need to watch this."

❌ NEVER suggest: politics, Taiwan, Hong Kong, US-China tensions, military, government policy
✅ ALWAYS focus on: what you can actually SEE, EAT, BUY, VISIT, or EXPERIENCE in China

Great content categories for Hesham:
- A place in China going viral to visit / check in
- Something cheap or surprising you can buy in China
- A Chinese city/neighborhood most people don't know
- A food or restaurant experience
- Something Chinese youth are obsessed with right now
- A market, exhibition, or festival happening
- A Chinese app or gadget that's fascinating
- A life hack or shortcut unique to living in China
- Behind the scenes of Chinese daily life
${hasRealData ? `\nSources fetched: ${successfulSources.join(", ")}` : "\nUsing general knowledge of current China trends."}`

    const userPrompt = `Date: ${date}
Focus: ${focusLabel[focus] || focusLabel.all}

${hasRealData ? `=== Real news & trends from China ===\n${newsContext}\n===\n` : ""}

Generate content ideas for @heshaminchina. Every idea must be something you can actually film/visit/experience in China.

JSON only (no markdown):
{
  "sourcesUsed": ["..."],
  "fetchedAt": "${date}",
  "trendingTopics": [
    {
      "topic": "What's happening / trending",
      "source": "where this came from",
      "whyRelevant": "why Arabs watching Hesham would care",
      "heshamAngle": "the unique insider angle only someone who lives in China could give"
    }
  ],
  "videoIdeas": [
    {
      "id": 1,
      "title": "Video title",
      "hook": "Opening line that stops the scroll",
      "concept": "What the video is actually about — specific, filmable",
      "sourceEvent": "The real event/trend that inspired this",
      "series": "city-series|chinese-brands|shopping|food-halal|advice|behind-scenes|other",
      "vibe": "viral|storytelling|informative|advice|behind-scenes|series-episode",
      "estimatedViralScore": 8,
      "whyNow": "Why this timing is perfect",
      "productionDifficulty": "سهل|متوسط|صعب",
      "keyTalkingPoints": ["point 1", "point 2", "point 3"],
      "suggestedCaption": "Caption in Arabic",
      "suggestedHashtags": ["#الصين", "#هشام_في_الصين"]
    }
  ],
  "seriesIdea": {
    "name": "Series name",
    "concept": "What makes this series binge-worthy",
    "episodes": ["ep 1", "ep 2", "ep 3", "ep 4", "ep 5"],
    "whyItWillGrow": "Why this builds an audience"
  },
  "quickWins": [
    {
      "idea": "Something you can film TODAY in China",
      "timeToFilm": "15 min|30 min|1 hour",
      "hook": "Opening hook",
      "sourceEvent": "What inspired this"
    }
  ]
}`

    const res = await openai.chat.completions.create({
      model: "gpt-4o",
      max_tokens: 2800,
      temperature: 0.88,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ]
    })

    const text = res.choices[0].message.content || "{}"
    const parsed = JSON.parse(text.replace(/```json|```/g, "").trim())
    parsed._meta = {
      sourcesAttempted: uniqueSources.map(s => s.label),
      sourcesFetched: successfulSources,
      fetchedAt: new Date().toISOString(),
      hasRealData,
      focus,
    }

    return NextResponse.json(parsed)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
