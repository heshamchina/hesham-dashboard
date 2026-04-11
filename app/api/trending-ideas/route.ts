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

function parseRSS(xml: string, label: string, maxItems = 6): string {
  const items: string[] = []
  const itemRegex = /<item>([\s\S]*?)<\/item>/g
  let match
  while ((match = itemRegex.exec(xml)) !== null && items.length < maxItems) {
    const block = match[1]
    const title = (/<title><!\[CDATA\[(.*?)\]\]><\/title>/.exec(block) || /<title>(.*?)<\/title>/.exec(block))?.[1]?.trim()
    const desc = (/<description><!\[CDATA\[(.*?)\]\]><\/description>/.exec(block) || /<description>(.*?)<\/description>/.exec(block))?.[1]
      ?.replace(/<[^>]+>/g, "")?.trim()?.slice(0, 150)
    const pubDate = (/<pubDate>(.*?)<\/pubDate>/.exec(block))?.[1]?.trim()
    if (title) items.push(`[${label}] ${title}${desc ? ` — ${desc}` : ""}${pubDate ? ` (${pubDate})` : ""}`)
  }
  return items.join("\n")
}

// ── NICHE-SPECIFIC SOURCES for Arab China content creators ─────────────────
// Only sources relevant to: China-Arab trade, halal travel China,
// Chinese consumer trends, Arab buyers/importers, China lifestyle for Muslims
const NICHE_SOURCES = {
  // China-Arab trade & sourcing — what buyers are looking for
  trade: [
    { url: "https://www.globaltimes.cn/rss/outbrain.xml",         label: "Global Times" },
    { url: "https://www.chinadaily.com.cn/rss/china_rss.xml",     label: "China Daily" },
    { url: "https://www.scmp.com/rss/4/feed",                     label: "SCMP Business" },
  ],
  // China economy, consumer trends, new products
  economy: [
    { url: "https://www.scmp.com/rss/11/feed",                    label: "SCMP Economy" },
    { url: "https://www.chinadaily.com.cn/rss/bizchina_rss.xml",  label: "China Daily Biz" },
    { url: "https://www.globaltimes.cn/rss/outbrain.xml",         label: "Global Times" },
  ],
  // China travel, tourism, new destinations
  travel: [
    { url: "https://www.chinadaily.com.cn/rss/travel_rss.xml",    label: "China Daily Travel" },
    { url: "https://www.scmp.com/rss/2/feed",                     label: "SCMP China" },
    { url: "https://www.globaltimes.cn/rss/outbrain.xml",         label: "Global Times" },
  ],
  // Middle East & Arab world — what's happening that relates to China
  arab: [
    { url: "https://feeds.bbci.co.uk/news/world/middle_east/rss.xml", label: "BBC Middle East" },
    { url: "https://www.scmp.com/rss/2/feed",                     label: "SCMP" },
  ],
  // Chinese tech, brands, products going global
  brands: [
    { url: "https://www.scmp.com/rss/4/feed",                     label: "SCMP Tech/Biz" },
    { url: "https://www.chinadaily.com.cn/rss/china_rss.xml",     label: "China Daily" },
    { url: "https://www.globaltimes.cn/rss/outbrain.xml",         label: "Global Times" },
  ],
}

const FOCUS_MAP: Record<string, (keyof typeof NICHE_SOURCES)[]> = {
  all:      ["trade", "economy", "travel", "brands"],
  china:    ["economy", "travel", "brands"],
  business: ["trade", "economy", "brands"],
  travel:   ["travel", "arab"],
  trending: ["trade", "economy", "brands"],
  ramadan:  ["arab", "travel"],
}

// Serper — search specifically for Arab-China content trends
async function serperNicheSearch(focus: string): Promise<string[]> {
  const key = process.env.SERPER_API_KEY
  if (!key) return []

  const queries: Record<string, string[]> = {
    all:      ["China Arab content creator trending 2025", "الصين العرب محتوى انستغرام ريلز"],
    china:    ["China trending viral content Arabic 2025", "صينا ريلز تريند عربي"],
    business: ["China sourcing wholesale Arab buyers 2025 trend", "توريد صين عرب 2025"],
    travel:   ["China Muslim halal travel 2025", "سياحة صين حلال مسلمين"],
    trending: ["China viral reels Arabic Instagram trending", "ريلز صين تريند 2025"],
    ramadan:  ["China halal Ramadan Muslim food travel", "رمضان صين حلال"],
  }

  const q = queries[focus] || queries.all
  try {
    const res = await fetchWithTimeout("https://google.serper.dev/search", {
      method: "POST",
      headers: { "X-API-KEY": key, "Content-Type": "application/json" },
      body: JSON.stringify({ q: q[0], num: 6, gl: "ae", hl: "ar" })
    })
    if (!res) return []
    const d = await res.json()
    return (d.organic || []).map((r: any) => `${r.title} — ${r.snippet}`).slice(0, 6)
  } catch { return [] }
}

export async function POST(req: NextRequest) {
  try {
    const { focus = "all", date = new Date().toISOString().split("T")[0] } = await req.json()

    const sourceKeys = FOCUS_MAP[focus] || FOCUS_MAP.all
    const sourcesToFetch = sourceKeys.flatMap(k => NICHE_SOURCES[k])

    // Deduplicate by URL
    const seen = new Set<string>()
    const uniqueSources = sourcesToFetch.filter(s => { if (seen.has(s.url)) return false; seen.add(s.url); return true })

    // Fetch all in parallel
    const [fetchResults, serperResults] = await Promise.all([
      Promise.allSettled(uniqueSources.map(async (src) => {
        const raw = await fetchWithTimeout(src.url, {}, 5000)
        if (!raw) return { label: src.label, items: "" }
        const xml = await raw.text()
        return { label: src.label, items: parseRSS(xml, src.label, 6) }
      })),
      serperNicheSearch(focus),
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
      newsLines.push(`=== Google Trends (Arab-China niche) ===\n${serperResults.join("\n")}`)
      successfulSources.push("Google Search")
    }

    const hasRealData = newsLines.length > 0
    const newsContext = newsLines.join("\n\n")

    const focusAr: Record<string, string> = {
      all:      "كل مواضيع نيش Hesham",
      china:    "الصين — أخبار ومواضيع للجمهور العربي",
      business: "التوريد والتجارة مع الصين",
      travel:   "السفر الحلال والسياحة في الصين",
      trending: "ما يتريند في الريلز العربي عن الصين",
      ramadan:  "محتوى رمضاني — حلال وإسلام في الصين",
    }

    const systemPrompt = `أنت استراتيجي محتوى احترافي متخصص في نيش ضيّق جداً: المحتوى العربي عن الصين.

عن @heshaminchina:
- أردني، 7 سنوات بالصين، 80+ مدينة، ~32K متابع
- جمهوره: عرب مهتمون بالصين — مسافرون، مستوردون، فضوليون
- محتواه: جولات مدن صينية، أكل حلال، أسواق جملة، ماركات صينية، حياة يومية

قاعدة مهمة:
❌ لا سياسة، لا هونج كونج، لا تايوان، لا أخبار عالمية عامة
❌ لا موضوع ما يهتم فيه الجمهور العربي المتابع لـ Hesham
✅ فقط مواضيع ترتبط بـ: الصين من منظور عربي، تجارة، سفر، أكل، ماركات، حياة يومية، توريد، حلال

${hasRealData ? `المصادر: ${successfulSources.join(", ")}` : "استخدم معرفتك بالأحداث الراهنة."}`

    const userPrompt = `التاريخ: ${date}
التركيز: ${focusAr[focus] || focusAr.all}

${hasRealData ? `=== أخبار حقيقية (مفلترة لنيش Hesham) ===\n${newsContext}\n=== نهاية الأخبار ===\n` : ""}

بناءً على ${hasRealData ? "هذه الأخبار" : "معرفتك"} — ولّد أفكار فيديو لـ @heshaminchina.

شرط: كل فكرة لازم تكون مرتبطة مباشرة بالصين وجمهوره العربي. لا عمومية.

JSON فقط (بدون markdown):
{
  "sourcesUsed": ["..."],
  "fetchedAt": "${date}",
  "trendingTopics": [
    {
      "topic": "الموضوع",
      "source": "المصدر",
      "whyRelevant": "ليش هذا الموضوع مهم لجمهور Hesham العربي",
      "heshamAngle": "الزاوية الفريدة لـ Hesham على هذا الموضوع — من منظوره الداخلي"
    }
  ],
  "videoIdeas": [
    {
      "id": 1,
      "title": "عنوان الفيديو",
      "hook": "الجملة الأولى",
      "concept": "شرح الفكرة — مرتبطة بالصين وجمهوره العربي",
      "sourceEvent": "الحدث أو الخبر اللي ألهم الفكرة",
      "series": "city-series|chinese-brands|shopping|food-halal|advice|behind-scenes|other",
      "vibe": "viral|storytelling|informative|advice|behind-scenes|series-episode",
      "estimatedViralScore": 7,
      "whyNow": "ليش الآن بالذات — مرتبط بالجمهور",
      "productionDifficulty": "سهل|متوسط|صعب",
      "keyTalkingPoints": ["نقطة 1", "نقطة 2", "نقطة 3"],
      "suggestedCaption": "كابشن",
      "suggestedHashtags": ["#الصين", "#هشام_في_الصين"]
    }
  ],
  "seriesIdea": {
    "name": "اسم السلسلة",
    "concept": "فكرة مرتبطة بالصين والجمهور العربي",
    "episodes": ["حلقة 1", "حلقة 2", "حلقة 3"],
    "whyItWillGrow": "ليش تبني جمهور"
  },
  "quickWins": [
    {
      "idea": "فكرة سريعة اليوم — مرتبطة بالصين",
      "timeToFilm": "15 دقيقة|30 دقيقة|ساعة",
      "hook": "الهوك",
      "sourceEvent": "الخبر اللي ألهمها"
    }
  ]
}`

    const res = await openai.chat.completions.create({
      model: "gpt-4o",
      max_tokens: 2500,
      temperature: 0.85,
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
      nicheFilter: "Arab-China content only",
    }

    return NextResponse.json(parsed)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
