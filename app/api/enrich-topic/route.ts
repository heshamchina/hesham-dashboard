import { NextRequest, NextResponse } from "next/server"
import OpenAI from "openai"

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
const UA = "Mozilla/5.0 (compatible; HeshamChinaDashboard/1.0)"

// ── Fetch helpers ─────────────────────────────────────────────────────────────
async function fetchWithTimeout(url: string, opts: RequestInit = {}, ms = 7000): Promise<Response | null> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), ms)
  try {
    const res = await fetch(url, {
      ...opts, signal: controller.signal,
      headers: { "User-Agent": UA, ...opts.headers }
    })
    return res.ok ? res : null
  } catch { return null } finally { clearTimeout(timer) }
}

// Jina AI Reader — converts any URL to clean markdown, free, no key
async function jinaRead(url: string): Promise<string> {
  const res = await fetchWithTimeout(
    `https://r.jina.ai/${url}`,
    { headers: { "Accept": "text/plain", "X-No-Cache": "true" } },
    10000
  )
  if (!res) return ""
  const text = await res.text()
  return text.slice(0, 3000) // cap per source
}

// ── Wikipedia ─────────────────────────────────────────────────────────────────
async function getWikipedia(query: string) {
  // Direct English
  const directRes = await fetchWithTimeout(
    `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query)}`
  )
  if (directRes) {
    const d = await directRes.json()
    if (d.extract && d.type !== "disambiguation") {
      return { title: d.displaytitle, summary: d.extract?.slice(0, 1500), image: d.thumbnail?.source || null, lang: "en" }
    }
  }
  // Search fallback
  const [enS, zhS] = await Promise.all([
    fetchWithTimeout(`https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}+China&format=json&origin=*&srlimit=2`),
    fetchWithTimeout(`https://zh.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&origin=*&srlimit=2`),
  ])
  if (enS) {
    const d = await enS.json()
    const title = d?.query?.search?.[0]?.title
    if (title) {
      const p = await fetchWithTimeout(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`)
      if (p) { const j = await p.json(); if (j.extract) return { title: j.displaytitle, summary: j.extract.slice(0, 1500), image: j.thumbnail?.source || null, lang: "en" } }
    }
  }
  if (zhS) {
    const d = await zhS.json()
    const title = d?.query?.search?.[0]?.title
    if (title) {
      const p = await fetchWithTimeout(`https://zh.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`)
      if (p) { const j = await p.json(); if (j.extract) return { title: j.displaytitle, summary: j.extract.slice(0, 1500), image: j.thumbnail?.source || null, lang: "zh" } }
    }
  }
  return null
}

// ── Nominatim ─────────────────────────────────────────────────────────────────
async function getCoordinates(query: string) {
  const res = await fetchWithTimeout(
    `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}+China&format=json&limit=1&addressdetails=1`,
    { headers: { "Accept-Language": "en" } }
  )
  if (!res) return null
  const d = await res.json()
  if (!d?.length) return null
  return {
    lat: parseFloat(d[0].lat), lon: parseFloat(d[0].lon),
    displayName: d[0].display_name,
    province: d[0].address?.state || d[0].address?.province || "",
  }
}

// ── Overpass POIs ─────────────────────────────────────────────────────────────
async function getPOIs(lat: number, lon: number, radiusKm = 50) {
  const r = radiusKm * 1000
  const rClose = Math.round(r * 0.4)
  const query = `
[out:json][timeout:30];
(
  node["tourism"="attraction"](around:${r},${lat},${lon});
  way["tourism"="attraction"](around:${r},${lat},${lon});
  node["tourism"~"museum|viewpoint|theme_park|resort|picnic_site"](around:${r},${lat},${lon});
  node["historic"~"."](around:${r},${lat},${lon});
  node["natural"~"peak|gorge|cave_entrance|waterfall|hot_spring"]["name"~"."](around:${r},${lat},${lon});
  way["natural"~"gorge|peak"]["name"~"."](around:${r},${lat},${lon});
  node["leisure"~"park|nature_reserve"]["name"~"."](around:${r},${lat},${lon});
  way["leisure"="nature_reserve"]["name"~"."](around:${r},${lat},${lon});
  node["sport"~"skiing|climbing|hiking|rafting"]["name"~"."](around:${r},${lat},${lon});
  node["amenity"="restaurant"]["cuisine"="halal"](around:${rClose},${lat},${lon});
  node["amenity"="restaurant"]["name"~"清真|穆斯林|新疆|回族",i](around:${rClose},${lat},${lon});
  node["amenity"="restaurant"]["name"~"."](around:${rClose},${lat},${lon});
  node["shop"~"market|mall|department_store"]["name"~"."](around:${r},${lat},${lon});
  node["amenity"="marketplace"]["name"~"."](around:${r},${lat},${lon});
  node["place"~"village|hamlet"]["name"~"."](around:${r},${lat},${lon});
);
out body 200;`
  const res = await fetchWithTimeout("https://overpass-api.de/api/interpreter",
    { method: "POST", body: query, headers: { "Content-Type": "text/plain" } }, 18000)
  if (!res) return null
  const d = await res.json()
  return d?.elements || []
}

function categorizePOIs(elements: any[]) {
  const named = elements.filter(e => e.tags?.name)
  const getName = (e: any) => e.tags?.["name:en"] || e.tags?.name || ""
  const seen = new Set<string>()
  const dedup = (arr: string[]) => arr.filter(n => { if (!n || seen.has(n)) return false; seen.add(n); return true })
  return {
    attractions: dedup(named.filter(e => ["attraction","museum","viewpoint","theme_park","resort","picnic_site"].includes(e.tags?.tourism) || e.tags?.historic).slice(0,15).map(getName)),
    nature:      dedup(named.filter(e => ["peak","gorge","cave_entrance","waterfall","hot_spring"].includes(e.tags?.natural||"") || ["nature_reserve","park"].includes(e.tags?.leisure||"")).slice(0,12).map(getName)),
    activities:  dedup(named.filter(e => e.tags?.sport || e.tags?.leisure === "recreation_ground").slice(0,8).map(getName)),
    halal:       dedup(named.filter(e => e.tags?.amenity==="restaurant" && (e.tags?.cuisine==="halal" || /清真|新疆|穆斯林|回族/.test(e.tags?.name||""))).slice(0,8).map(getName)),
    restaurants: dedup(named.filter(e => e.tags?.amenity==="restaurant").slice(0,10).map(getName)),
    markets:     dedup(named.filter(e => ["market","mall","marketplace","department_store"].includes(e.tags?.shop||e.tags?.amenity||"")).slice(0,8).map(getName)),
    villages:    dedup(named.filter(e => ["village","hamlet"].includes(e.tags?.place||"")).slice(0,6).map(getName)),
  }
}

// ── Web scraping via Jina + targeted URLs ─────────────────────────────────────
async function scrapeWebSources(query: string, englishName: string) {
  const q = encodeURIComponent(englishName || query)
  const qRaw = (englishName || query).toLowerCase().replace(/\s+/g, "-")

  // Targeted URLs most likely to have real traveler recommendations
  const targets = [
    // GetYourGuide activities
    { label: "GetYourGuide", url: `https://www.getyourguide.com/s/?q=${q}&searchSource=2` },
    // TripAdvisor things to do
    { label: "TripAdvisor", url: `https://www.tripadvisor.com/Search?q=${q}&searchSessionId=x&sid=x&blockRedirect=true` },
    // Lonely Planet
    { label: "Lonely Planet", url: `https://www.lonelyplanet.com/search?q=${q}` },
    // Travel China Guide
    { label: "TravelChinaGuide", url: `https://www.travelchinaguide.com/attraction/${qRaw}.htm` },
    // China Highlights — very good for Chinese cities
    { label: "ChinaHighlights", url: `https://www.chinahighlights.com/search/?q=${q}` },
    // Reddit search via old API (public JSON)
    { label: "Reddit", url: `https://www.reddit.com/search.json?q=${q}+china+travel&sort=top&limit=5&type=link` },
    // Mafengwo — Chinese travel recommendations (Jina can translate)
    { label: "Mafengwo", url: `https://www.mafengwo.cn/search/q.php?q=${encodeURIComponent(query)}` },
    // Ctrip/Trip.com destination page
    { label: "Trip.com", url: `https://www.trip.com/travel-guide/attraction/${qRaw}-tourism/` },
  ]

  // Fetch all in parallel, cap at 10s each
  const results = await Promise.allSettled(
    targets.map(async (t) => {
      const text = await jinaRead(t.url)
      return { label: t.label, text: text.trim() }
    })
  )

  const scraped: { label: string; text: string }[] = []
  for (const r of results) {
    if (r.status === "fulfilled" && r.value.text && r.value.text.length > 100) {
      scraped.push(r.value)
    }
  }
  return scraped
}

// ── Serper.dev Google search (optional, needs key) ────────────────────────────
async function serperSearch(query: string): Promise<string[]> {
  const key = process.env.SERPER_API_KEY
  if (!key) return []
  try {
    const res = await fetchWithTimeout("https://google.serper.dev/search", {
      method: "POST",
      headers: { "X-API-KEY": key, "Content-Type": "application/json" },
      body: JSON.stringify({ q: `${query} China travel recommendations things to do`, gl: "cn", num: 8 })
    })
    if (!res) return []
    const d = await res.json()
    return (d.organic || []).map((r: any) => `[${r.title}] ${r.snippet} — ${r.link}`).slice(0, 8)
  } catch { return [] }
}

// ── GPT synthesis — turn all raw data into structured recommendations ──────────
async function synthesizeWithGPT(query: string, sources: {
  wiki: any, pois: any, scraped: { label: string; text: string }[], serper: string[]
}) {
  const parts: string[] = []

  if (sources.wiki?.summary) {
    parts.push(`=== Wikipedia ===\n${sources.wiki.summary}`)
  }
  if (sources.pois) {
    const p = sources.pois
    if (p.attractions?.length)  parts.push(`Attractions (OSM): ${p.attractions.join(", ")}`)
    if (p.nature?.length)       parts.push(`Nature/Mountains/Caves (OSM): ${p.nature.join(", ")}`)
    if (p.activities?.length)   parts.push(`Activities (OSM): ${p.activities.join(", ")}`)
    if (p.halal?.length)        parts.push(`Halal restaurants (OSM): ${p.halal.join(", ")}`)
    if (p.restaurants?.length)  parts.push(`Restaurants (OSM): ${p.restaurants.slice(0,6).join(", ")}`)
    if (p.markets?.length)      parts.push(`Markets/Shopping (OSM): ${p.markets.join(", ")}`)
    if (p.villages?.length)     parts.push(`Traditional villages (OSM): ${p.villages.join(", ")}`)
  }
  for (const s of sources.scraped) {
    if (s.text) parts.push(`=== ${s.label} ===\n${s.text.slice(0, 1500)}`)
  }
  if (sources.serper.length) {
    parts.push(`=== Google Search Results ===\n${sources.serper.join("\n")}`)
  }

  if (parts.length === 0) return null

  const res = await openai.chat.completions.create({
    model: "gpt-4o",
    max_tokens: 1800,
    temperature: 0.3,
    messages: [{
      role: "system",
      content: `You are extracting structured travel intelligence about "${query}" in China from raw web data.
Extract only real, specific, named places and experiences. No fluff. No hallucination — if it's not in the data, don't include it.
Respond in JSON only.`
    }, {
      role: "user",
      content: `Raw data from multiple sources about "${query}":\n\n${parts.join("\n\n")}\n\n
Extract and structure into JSON (no markdown):
{
  "topAttractions": [{"name": "...", "description": "...", "source": "..."}],
  "natureLandscapes": [{"name": "...", "description": "...", "source": "..."}],
  "activities": [{"name": "...", "description": "...", "source": "..."}],
  "foodAndHalal": [{"name": "...", "type": "halal|local|cafe", "note": "...", "source": "..."}],
  "shopping": [{"name": "...", "note": "...", "source": "..."}],
  "hiddenGems": [{"name": "...", "why": "...", "source": "..."}],
  "practicalTips": ["tip 1", "tip 2", "tip 3"],
  "bestFor": ["families", "adventurers", "business buyers", etc],
  "whatPeopleSay": ["real quote or recommendation from scraped data", ...],
  "arabAngle": "specific angle for Arab/Muslim travelers visiting this place"
}`
    }]
  })

  try {
    const text = res.choices[0].message.content || "{}"
    return JSON.parse(text.replace(/```json|```/g, "").trim())
  } catch { return null }
}

// ── Main ──────────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const { topic } = await req.json()
    if (!topic?.trim()) return NextResponse.json({ error: "No topic" }, { status: 400 })

    // Phase 1: fast parallel fetches
    const [wiki, coords] = await Promise.all([
      getWikipedia(topic),
      getCoordinates(topic),
    ])

    // Use English title from wiki for better URL targeting
    const englishName = wiki?.title || topic

    // Phase 2: parallel — OSM POIs + web scraping + Serper
    const [rawPOIs, scraped, serper] = await Promise.all([
      coords ? getPOIs(coords.lat, coords.lon) : Promise.resolve(null),
      scrapeWebSources(topic, englishName),
      serperSearch(`${englishName} ${topic}`),
    ])

    const pois = rawPOIs ? categorizePOIs(rawPOIs) : null

    // Phase 3: GPT synthesizes everything into structured recommendations
    const synthesized = await synthesizeWithGPT(topic, { wiki, pois, scraped, serper })

    const sourceLabels = ["Wikipedia", "OpenStreetMap", ...scraped.map(s => s.label), ...(serper.length ? ["Google/Serper"] : [])]

    return NextResponse.json({
      topic,
      wiki,
      coords,
      pois,           // raw OSM data (for backward compat)
      synthesized,    // GPT-structured recommendations
      sourceLabels,
      fetchedAt: new Date().toISOString(),
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
