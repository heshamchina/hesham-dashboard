import { NextRequest, NextResponse } from "next/server"
import OpenAI from "openai"

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
const UA = "Mozilla/5.0 (compatible; HeshamChinaDashboard/1.0)"

async function fetchWithTimeout(url: string, opts: RequestInit = {}, ms = 10000): Promise<Response | null> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), ms)
  try {
    const res = await fetch(url, { ...opts, signal: controller.signal, headers: { "User-Agent": UA, ...opts.headers } })
    return res.ok ? res : null
  } catch { return null } finally { clearTimeout(timer) }
}

async function jinaRead(url: string, ms = 10000): Promise<string> {
  const res = await fetchWithTimeout(`https://r.jina.ai/${url}`, {
    headers: { "Accept": "text/plain", "X-No-Cache": "true" }
  }, ms)
  if (!res) return ""
  const text = await res.text()
  // Skip Instagram login walls
  if (text.includes("Log into Instagram") || text.includes("See everyday moments")) return ""
  return text.slice(0, 3000)
}

async function serperSearch(queries: string[]): Promise<string> {
  const key = process.env.SERPER_API_KEY
  if (!key) return ""

  const results = await Promise.allSettled(
    queries.map(async (q) => {
      const res = await fetchWithTimeout("https://google.serper.dev/search", {
        method: "POST",
        headers: { "X-API-KEY": key, "Content-Type": "application/json" },
        body: JSON.stringify({ q, num: 5, gl: "us", hl: "en" })
      })
      if (!res) return ""
      const d = await res.json()
      const lines: string[] = []
      // Knowledge graph first — often has follower counts
      if (d.knowledgeGraph) {
        const kg = d.knowledgeGraph
        lines.push(`[Knowledge Graph] ${kg.title || ""} — ${kg.description || ""} | ${JSON.stringify(kg.attributes || {})}`)
      }
      for (const r of (d.organic || []).slice(0, 5)) {
        lines.push(`[${r.title}] ${r.snippet} — ${r.link}`)
      }
      return `Query: "${q}"\n${lines.join("\n")}`
    })
  )

  return results
    .filter(r => r.status === "fulfilled" && (r as any).value)
    .map(r => (r as any).value)
    .join("\n\n")
}

export async function POST(req: NextRequest) {
  try {
    const { handle, manualProfile = {} } = await req.json()
    const cleanHandle = handle.replace(/^@/, "").trim()

    const hasManual = !!(manualProfile.followers || manualProfile.bio || manualProfile.posts)

    // Serper: search for content info, not profile stats (we have those manually)
    const [serperData, socialBlade] = await Promise.all([
      serperSearch([
        `"${cleanHandle}" instagram china arab content reels`,
        `@${cleanHandle} instagram top videos views`,
        `"${cleanHandle}" instagram china creator arabic review`,
      ]),
      jinaRead(`https://socialblade.com/instagram/user/${cleanHandle}`, 8000),
    ])

    // Build the context
    const contextParts: string[] = []

    // Manual data is GROUND TRUTH — put it first, clearly labeled
    if (hasManual) {
      const m = manualProfile
      contextParts.push(`=== VERIFIED PROFILE DATA (entered manually by user) ===
Handle: @${cleanHandle}
Followers: ${m.followers || "not provided"}
Following: ${m.following || "not provided"}
Posts: ${m.posts || "not provided"}
Bio: ${m.bio || "not provided"}
Average Views per Reel: ${m.avgViews || "not provided"}
Niche/Content Type: ${m.niche || "not provided"}
Profile URL: https://www.instagram.com/${cleanHandle}/`)
    }

    if (serperData) {
      contextParts.push(`=== Google Search Results ===\n${serperData}`)
    }

    if (socialBlade && socialBlade.length > 200) {
      contextParts.push(`=== SocialBlade Analytics ===\n${socialBlade}`)
    }

    const systemPrompt = `أنت محلل محتوى احترافي متخصص في صناع المحتوى العرب عن الصين على إنستغرام.

قواعد:
- البيانات اليدوية (VERIFIED PROFILE DATA) هي الأدق — استخدمها كما هي بدون تعديل
- بيانات جوجل تكمّل التصوير العام للمحتوى والأسلوب
- لا تخترع أرقاماً أو معلومات غير موجودة في البيانات
- الردود بالعربية الفصحى المبسطة`

    const userPrompt = `البيانات عن @${cleanHandle}:

${contextParts.join("\n\n")}

السياق عن @heshaminchina (من يستخدم هذه الأداة):
- أردني، 7 سنوات بالصين، 80+ مدينة، ~32K متابع إنستغرام
- محتوى عربي: جولات، حلال، تسوق، ماركات، حياة يومية

قدم التحليل بـ JSON فقط (بدون markdown):
{
  "profileSummary": {
    "followers": "${manualProfile.followers || "لم يُحدَّد"}",
    "following": "${manualProfile.following || "لم يُحدَّد"}",
    "postsCount": "${manualProfile.posts || "لم يُحدَّد"}",
    "bio": "${manualProfile.bio || "لم يُحدَّد"}",
    "avgViews": "${manualProfile.avgViews || "لم يُحدَّد"}",
    "contentStyle": "وصف أسلوب المحتوى بناءً على البيانات",
    "postingFrequency": "من البيانات أو تقدير مبني على المنشورات",
    "engagementRate": "احسب إذا عندك متابعين + مشاهدات، وإلا اكتب لم يُحدَّد",
    "audienceType": "من البيانات"
  },
  "topVideoThemes": [
    {
      "theme": "موضوع مبني على البيانات",
      "whyItWorks": "ليش ينجح",
      "estimatedViews": "من البيانات أو لم يُحدَّد"
    }
  ],
  "strengths": ["نقاط قوة حقيقية من البيانات — على الأقل 3"],
  "weaknesses": ["نقاط ضعف حقيقية — على الأقل 2"],
  "contentGaps": [
    {
      "gap": "فجوة حقيقية في محتواه",
      "opportunity": "كيف يستغلها Hesham بالتحديد"
    }
  ],
  "battlePlan": [
    {
      "idea": "فكرة فيديو محددة وقابلة للتنفيذ",
      "hook": "هوك مقترح",
      "series": "city-series|chinese-brands|shopping|food-halal|advice|behind-scenes|other",
      "vibe": "viral|storytelling|informative|advice|behind-scenes|series-episode",
      "whyItBeats": "ليش هالفيديو يتفوق عليه",
      "urgency": "عاجل|هذا الأسبوع|الشهر الجاي"
    }
  ],
  "strategicInsight": "الاستراتيجية الأذكى لـ Hesham للتفوق — مبنية على الأرقام الحقيقية",
  "watchOut": "شي حقيقي يتعلمه Hesham من هذا الحساب"
}`

    const res = await openai.chat.completions.create({
      model: "gpt-4o",
      max_tokens: 2000,
      temperature: 0.25,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ]
    })

    const text = res.choices[0].message.content || "{}"
    const parsed = JSON.parse(text.replace(/```json|```/g, "").trim())

    parsed._meta = {
      handle: cleanHandle,
      profileUrl: `https://www.instagram.com/${cleanHandle}/`,
      hasManual,
      hasSerper: !!process.env.SERPER_API_KEY && serperData.length > 0,
      hasSocialBlade: socialBlade.length > 200,
      dataQuality: hasManual ? "real" : serperData.length > 100 ? "partial" : "none",
    }

    return NextResponse.json(parsed)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
