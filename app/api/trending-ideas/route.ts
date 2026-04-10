import { NextRequest, NextResponse } from "next/server"
import OpenAI from "openai"

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

// ── Real sources to fetch ──────────────────────────────────────────────────
// All public RSS feeds / JSON endpoints — no API keys needed
const SOURCES: Record<string, { url: string; label: string; type: "rss" | "json" }[]> = {
  china: [
    { url: "https://www.scmp.com/rss/2/feed", label: "SCMP China", type: "rss" },
    { url: "https://feeds.bbci.co.uk/news/world/asia/china/rss.xml", label: "BBC China", type: "rss" },
    { url: "https://rss.nytimes.com/services/xml/rss/nyt/China.xml", label: "NYT China", type: "rss" },
  ],
  business: [
    { url: "https://feeds.bbci.co.uk/news/business/rss.xml", label: "BBC Business", type: "rss" },
    { url: "https://rss.nytimes.com/services/xml/rss/nyt/Business.xml", label: "NYT Business", type: "rss" },
    { url: "https://www.globaltimes.cn/rss/outbrain.xml", label: "Global Times", type: "rss" },
  ],
  travel: [
    { url: "https://feeds.bbci.co.uk/news/world/rss.xml", label: "BBC World", type: "rss" },
    { url: "https://www.chinadaily.com.cn/rss/china_rss.xml", label: "China Daily", type: "rss" },
  ],
  trending: [
    { url: "https://feeds.bbci.co.uk/news/world/rss.xml", label: "BBC World", type: "rss" },
    { url: "https://rss.nytimes.com/services/xml/rss/nyt/World.xml", label: "NYT World", type: "rss" },
    { url: "https://www.globaltimes.cn/rss/outbrain.xml", label: "Global Times", type: "rss" },
  ],
  all: [
    { url: "https://www.scmp.com/rss/2/feed", label: "SCMP China", type: "rss" },
    { url: "https://feeds.bbci.co.uk/news/world/asia/china/rss.xml", label: "BBC China", type: "rss" },
    { url: "https://www.chinadaily.com.cn/rss/china_rss.xml", label: "China Daily", type: "rss" },
    { url: "https://www.globaltimes.cn/rss/outbrain.xml", label: "Global Times", type: "rss" },
  ],
  ramadan: [
    { url: "https://feeds.bbci.co.uk/news/world/middle_east/rss.xml", label: "BBC Middle East", type: "rss" },
    { url: "https://www.scmp.com/rss/2/feed", label: "SCMP China", type: "rss" },
    { url: "https://www.chinadaily.com.cn/rss/china_rss.xml", label: "China Daily", type: "rss" },
  ],
}

// ── Parse RSS XML manually (no deps needed) ───────────────────────────────
function parseRSS(xml: string, label: string, maxItems = 8): string {
  const items: string[] = []
  const itemRegex = /<item>([\s\S]*?)<\/item>/g
  let match
  while ((match = itemRegex.exec(xml)) !== null && items.length < maxItems) {
    const block = match[1]
    const title = (/<title><!\[CDATA\[(.*?)\]\]><\/title>/.exec(block) || /<title>(.*?)<\/title>/.exec(block))?.[1]?.trim()
    const desc = (/<description><!\[CDATA\[(.*?)\]\]><\/description>/.exec(block) || /<description>(.*?)<\/description>/.exec(block))?.[1]
      ?.replace(/<[^>]+>/g, "")
      ?.trim()
      ?.slice(0, 200)
    const pubDate = (/<pubDate>(.*?)<\/pubDate>/.exec(block))?.[1]?.trim()
    if (title) {
      items.push(`[${label}] ${title}${desc ? ` — ${desc}` : ""}${pubDate ? ` (${pubDate})` : ""}`)
    }
  }
  return items.join("\n")
}

// ── Fetch with timeout ─────────────────────────────────────────────────────
async function fetchWithTimeout(url: string, ms = 5000): Promise<string> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), ms)
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "Mozilla/5.0 (compatible; RSSReader/1.0)" }
    })
    if (!res.ok) return ""
    return await res.text()
  } catch {
    return ""
  } finally {
    clearTimeout(timer)
  }
}

// ── Main handler ──────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const { focus = "all", date = new Date().toISOString().split("T")[0] } = await req.json()

    const sources = SOURCES[focus] || SOURCES.all

    // Fetch all sources in parallel
    const fetchResults = await Promise.allSettled(
      sources.map(async (src) => {
        const raw = await fetchWithTimeout(src.url, 5000)
        if (!raw) return { label: src.label, items: "" }
        const items = parseRSS(raw, src.label, 8)
        return { label: src.label, items }
      })
    )

    // Collect successful results
    const newsLines: string[] = []
    const successfulSources: string[] = []
    for (const result of fetchResults) {
      if (result.status === "fulfilled" && result.value.items) {
        newsLines.push(result.value.items)
        successfulSources.push(result.value.label)
      }
    }

    const newsContext = newsLines.join("\n\n")
    const hasRealData = newsLines.length > 0

    const focusAr: Record<string, string> = {
      all: "كل المواضيع",
      trending: "تريند الريلز العربي",
      china: "أخبار وأحداث الصين",
      business: "توريد وتجارة مع الصين",
      travel: "السفر والتأشيرات",
      ramadan: "محتوى رمضاني وإسلامي",
    }

    const systemPrompt = `أنت استراتيجي محتوى احترافي متخصص في الريلز العربية عن الصين.

عن @heshaminchina: أردني، 7 سنوات بالصين، 80+ مدينة، 32K+ متابع، محتوى عربي عن الصين.
الجمهور: عرب مهتمون بالصين — سياحة، تجارة، حياة يومية، أكل حلال.

مهمتك: حول الأخبار والأحداث الحقيقية التالية إلى أفكار فيديو ذكية ومناسبة لـ Hesham.
${hasRealData ? `\nالمصادر المستخدمة: ${successfulSources.join(", ")}` : "\nلم تتوفر أخبار حية، استخدم معرفتك العامة بالأحداث الراهنة."}`

    const userPrompt = `التاريخ: ${date}
التركيز: ${focusAr[focus] || focusAr.all}

${hasRealData ? `=== الأخبار الحقيقية من المصادر الموثوقة ===\n${newsContext}\n=== نهاية الأخبار ===\n` : ""}

بناءً على ${hasRealData ? "هذه الأخبار الحقيقية" : "معرفتك بالأحداث الراهنة"}، ولّد أفكار ريلز لـ @heshaminchina.

قواعد مهمة:
1. كل فكرة لازم مرتبطة بحدث أو خبر حقيقي من القائمة أعلاه
2. اشرح ليش هالحدث بالذات فرصة لـ Hesham الآن
3. الزاوية لازم تكون خاصة فيه — insider view، مش تغطية إخبارية
4. ربط الخبر بحياة الجمهور العربي اليومية أو تجارتهم

الرد JSON فقط (بدون markdown):
{
  "sourcesUsed": ["اسم المصدر 1", "اسم المصدر 2"],
  "fetchedAt": "${date}",
  "trendingTopics": [
    {
      "topic": "الموضوع التريندي",
      "source": "المصدر اللي جاء منه",
      "whyTrending": "ليش هو رائج الآن بالتحديد",
      "heshamAngle": "الزاوية الفريدة لـ Hesham على هذا الموضوع"
    }
  ],
  "videoIdeas": [
    {
      "id": 1,
      "title": "عنوان الفيديو",
      "hook": "الجملة الأولى",
      "concept": "شرح الفكرة مع ربطها بالخبر الحقيقي",
      "sourceEvent": "الخبر/الحدث الحقيقي اللي ألهم الفكرة",
      "series": "city-series|chinese-brands|shopping|food-halal|advice|behind-scenes|other",
      "vibe": "viral|storytelling|informative|advice|behind-scenes|series-episode",
      "estimatedViralScore": 1,
      "whyNow": "ليش الآن بالذات",
      "productionDifficulty": "سهل|متوسط|صعب",
      "keyTalkingPoints": ["نقطة 1", "نقطة 2", "نقطة 3"],
      "suggestedCaption": "كابشن مقترح",
      "suggestedHashtags": ["#هاشتاق1", "#هاشتاق2"]
    }
  ],
  "seriesIdea": {
    "name": "اسم السلسلة",
    "concept": "فكرة السلسلة",
    "episodes": ["حلقة 1", "حلقة 2", "حلقة 3", "حلقة 4", "حلقة 5"],
    "whyItWillGrow": "ليش تبني جمهور"
  },
  "quickWins": [
    {
      "idea": "فكرة سريعة مرتبطة بخبر حالي",
      "timeToFilm": "15 دقيقة|30 دقيقة|ساعة",
      "hook": "الهوك",
      "sourceEvent": "الحدث اللي ألهمها"
    }
  ]
}`

    const res = await openai.chat.completions.create({
      model: "gpt-4o",
      max_tokens: 2500,
      temperature: 0.8,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ]
    })

    const text = res.choices[0].message.content || "{}"
    const parsed = JSON.parse(text.replace(/```json|```/g, "").trim())

    // Inject metadata about sources
    parsed._meta = {
      sourcesAttempted: sources.map(s => s.label),
      sourcesFetched: successfulSources,
      fetchedAt: new Date().toISOString(),
      hasRealData,
    }

    return NextResponse.json(parsed)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
