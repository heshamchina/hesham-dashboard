"use client"
import { useState, useRef } from "react"
import { useStore } from "@/lib/store"
import { SERIES_LABELS, VIBE_LABELS, STATUS_LABELS } from "@/lib/constants"
import { supabase } from "@/lib/supabase"
import clsx from "clsx"
import type { ContentSeries, ContentVibe, ContentStatus } from "@/types"
import SocialSection from "./SocialSection"
import VoiceoverStudio from "./VoiceoverStudio"

// ── Tab definitions ─────────────────────────────────────────────
const IG_TABS = [
  { id: "growth",      label: "Growth",      icon: "📈" },
  { id: "content",     label: "Content",     icon: "✍️" },
  { id: "competitors", label: "Competitors", icon: "🔍" },
]

// ── Sub-tabs inside Content ────────────────────────────────────
const CONTENT_TABS = [
  { id: "trending",  label: "Trending",   icon: "🔥" },
  { id: "script",    label: "Script AI",  icon: "✍️" },
  { id: "voiceover", label: "Voiceover",  icon: "🎙" },
  { id: "pipeline",  label: "Pipeline",   icon: "🎬" },
]

const VIRAL_COLOR = (score: number) => {
  if (score >= 8) return "text-green-400 font-bold"
  if (score >= 6) return "text-yellow-400 font-semibold"
  return "text-ink-muted"
}

const URGENCY_COLOR: Record<string, { bg: string; text: string }> = {
  "عاجل":        { bg: "#3D0A0A", text: "#FF6B6B" },
  "هذا الأسبوع": { bg: "#2A1E00", text: "#D4A017" },
  "الشهر الجاي": { bg: "#0D2016", text: "#4ADE80" },
}

// ── Scrape config types ─────────────────────────────────────────
interface ScrapeTarget {
  id: string
  type: "account" | "hashtag"
  target: string
  active: boolean
  label: string | null
  created_at: string
}

interface ScrapeResult {
  id: string
  type: string
  target: string
  data: any
  scraped_at: string
}

export default function InstagramSuite() {
  const store = useStore()
  const [tab, setTab] = useState("growth")
  const [contentTab, setContentTab] = useState("trending")

  // ── Trending state ───────────────────────────────────────────
  const [trendingFocus, setTrendingFocus] = useState("all")
  const [trendingResult, setTrendingResult] = useState<any>(null)
  const [trendingLoading, setTrendingLoading] = useState(false)
  const [expandedIdea, setExpandedIdea] = useState<number | null>(null)

  // ── Script state ─────────────────────────────────────────────
  const [scriptForm, setScriptForm] = useState({
    series: "city-series" as ContentSeries,
    vibe: "viral" as ContentVibe,
    topic: "",
    language: "ar",
    tone: "jordanian",
    duration: 60,
  })
  const [scriptResult, setScriptResult] = useState<any>(null)
  const [scriptLoading, setScriptLoading] = useState(false)
  const [activeHook, setActiveHook] = useState(0)
  const [copiedSection, setCopiedSection] = useState<string | null>(null)
  const [enrichment, setEnrichment] = useState<any>(null)
  const [enrichLoading, setEnrichLoading] = useState(false)
  const [enrichError, setEnrichError] = useState(false)

  // ── Pipeline state ───────────────────────────────────────────
  const [filterSeries, setFilterSeries] = useState<string>("all")
  const [filterStatus, setFilterStatus] = useState<string>("all")
  const [showIdeaForm, setShowIdeaForm] = useState(false)
  const [newIdea, setNewIdea] = useState({
    series: "city-series" as ContentSeries,
    hook: "", script: "", vibe: "viral" as ContentVibe,
    status: "idea" as ContentStatus, notes: ""
  })

  // ── Competitor state ─────────────────────────────────────────
  const [handle, setHandle] = useState("")
  const [competitorResult, setCompetitorResult] = useState<any>(null)
  const [competitorLoading, setCompetitorLoading] = useState(false)
  const [competitorTab, setCompetitorTab] = useState("overview")
  const [manualProfile, setManualProfile] = useState({
    followers: "", following: "", posts: "", bio: "", avgViews: "", niche: ""
  })

  // ── Scrape targets state ─────────────────────────────────────
  const [scrapeTargets, setScrapeTargets] = useState<ScrapeTarget[]>([])
  const [scrapeResults, setScrapeResults] = useState<ScrapeResult[]>([])
  const [scrapeLoaded, setScrapeLoaded] = useState(false)
  const [scrapeLoading, setScrapeLoading] = useState(false)
  const [newTarget, setNewTarget] = useState({ type: "account" as "account" | "hashtag", target: "", label: "" })
  const [showAddTarget, setShowAddTarget] = useState(false)

  const filteredIdeas = store.contentIdeas.filter(i => {
    if (filterSeries !== "all" && i.series !== filterSeries) return false
    if (filterStatus !== "all" && i.status !== filterStatus) return false
    return true
  })

  // ── API helpers ──────────────────────────────────────────────

  async function loadTrending() {
    setTrendingLoading(true)
    setTrendingResult(null)
    try {
      const res = await fetch("/api/trending-ideas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ focus: trendingFocus, date: new Date().toISOString().split("T")[0] })
      })
      setTrendingResult(await res.json())
    } catch {}
    setTrendingLoading(false)
  }

  async function enrichTopic(topic: string) {
    if (!topic.trim()) return
    setEnrichLoading(true)
    setEnrichment(null)
    setEnrichError(false)
    try {
      const res = await fetch("/api/enrich-topic", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic })
      })
      const data = await res.json()
      if (data.error) { setEnrichError(true); return }
      setEnrichment(data)
    } catch { setEnrichError(true) }
    finally { setEnrichLoading(false) }
  }

  async function generateScript() {
    if (!scriptForm.topic.trim()) return
    setScriptLoading(true)
    setScriptResult(null)
    setActiveHook(0)
    try {
      const res = await fetch("/api/generate-script", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...scriptForm, enrichment })
      })
      setScriptResult(await res.json())
    } catch {}
    setScriptLoading(false)
  }

  async function analyzeCompetitor() {
    if (!handle.trim()) return
    setCompetitorLoading(true)
    setCompetitorResult(null)
    setCompetitorTab("overview")
    try {
      const res = await fetch("/api/analyze-competitor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ handle: handle.replace("@", ""), manualProfile })
      })
      setCompetitorResult(await res.json())
    } catch {}
    setCompetitorLoading(false)
  }

  async function loadScrapeData() {
    if (scrapeLoaded) return
    setScrapeLoading(true)
    const [{ data: targets }, { data: results }] = await Promise.all([
      supabase.from("scrape_config").select("*").order("created_at", { ascending: false }),
      supabase.from("scrape_results").select("*").order("scraped_at", { ascending: false }).limit(50),
    ])
    setScrapeTargets(targets || [])
    setScrapeResults(results || [])
    setScrapeLoaded(true)
    setScrapeLoading(false)
  }

  async function addScrapeTarget() {
    if (!newTarget.target.trim()) return
    const { data } = await supabase.from("scrape_config").insert({
      type: newTarget.type,
      target: newTarget.target.trim().replace(/^@/, ""),
      label: newTarget.label.trim() || null,
      active: true,
    }).select().single()
    if (data) setScrapeTargets(t => [data, ...t])
    setNewTarget({ type: "account", target: "", label: "" })
    setShowAddTarget(false)
  }

  async function toggleScrapeTarget(id: string, active: boolean) {
    await supabase.from("scrape_config").update({ active }).eq("id", id)
    setScrapeTargets(ts => ts.map(t => t.id === id ? { ...t, active } : t))
  }

  async function deleteScrapeTarget(id: string) {
    await supabase.from("scrape_config").delete().eq("id", id)
    setScrapeTargets(ts => ts.filter(t => t.id !== id))
  }

  function copyText(text: string, key: string) {
    navigator.clipboard.writeText(text)
    setCopiedSection(key)
    setTimeout(() => setCopiedSection(null), 2000)
  }

  function saveScriptToIdea() {
    if (!scriptResult) return
    const hook = scriptResult.hookAlternatives?.[activeHook] || scriptResult.hook
    store.addIdea({
      series: scriptForm.series, vibe: scriptForm.vibe, status: "scripted", hook,
      script: `HOOK:\n${hook}\n\nBODY:\n${scriptResult.body}\n\nCTA:\n${scriptResult.cta}`,
      notes: scriptResult.filmingTips?.join(" | ") || "",
    })
  }

  function saveTrendingIdea(idea: any) {
    store.addIdea({
      series: idea.series, vibe: idea.vibe, hook: idea.hook,
      script: `CONCEPT:\n${idea.concept}\n\nTALKING POINTS:\n${idea.keyTalkingPoints?.join("\n")}`,
      status: "idea",
      notes: `Viral Score: ${idea.estimatedViralScore}/10 | ${idea.whyNow}`,
    })
  }

  // ── Render ───────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      <h1 className="text-display">Instagram Suite</h1>

      {/* Main tab bar */}
      <div className="flex gap-1 p-1 border border-surface-border rounded-xl" style={{ backgroundColor: "#1A1A1A" }}>
        {IG_TABS.map(t => (
          <button key={t.id} onClick={() => { setTab(t.id); if (t.id === "competitors") loadScrapeData() }}
            className={clsx("flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-medium transition-all")}
            style={tab === t.id
              ? { background: "#A51C1C", color: "#fff" }
              : { color: "#707070" }}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* ════════════════════════════════════════════════ */}
      {/* GROWTH                                          */}
      {/* ════════════════════════════════════════════════ */}
      {tab === "growth" && <SocialSection />}

      {/* ════════════════════════════════════════════════ */}
      {/* CONTENT                                         */}
      {/* ════════════════════════════════════════════════ */}
      {tab === "content" && (
        <div className="space-y-4">
          {/* Content sub-tab bar */}
          <div className="flex gap-1 p-0.5 border border-surface-border rounded-xl overflow-x-auto" style={{ backgroundColor: "#181818" }}>
            {CONTENT_TABS.map(t => (
              <button key={t.id} onClick={() => setContentTab(t.id)}
                className="flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-all"
                style={contentTab === t.id
                  ? { background: "#252525", color: "#F0F0F0" }
                  : { color: "#606060" }}>
                {t.icon} {t.label}
              </button>
            ))}
          </div>

          {/* ── TRENDING ─────────────────────────────── */}
          {contentTab === "trending" && (
            <div className="space-y-4">
              <div className="rounded-2xl p-4 space-y-3" style={{ background: "#1A1A1A", border: "1px solid #252525" }}>
                <div>
                  <h2 className="font-bold text-ink-primary">🔥 ما يحصل في الصين الآن</h2>
                  <p className="text-xs text-ink-muted mt-0.5">مدن، أماكن تتريند، شباب، أكل، أسواق، تطبيقات، معارض</p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { id: "all", label: "🌐 كل شي" },
                    { id: "trending", label: "🔥 تريند الشباب" },
                    { id: "travel", label: "📍 مدن وأماكن" },
                    { id: "china", label: "🇨🇳 حياة يومية" },
                    { id: "business", label: "🛍 أسواق وتوريد" },
                    { id: "ramadan", label: "🌙 حلال ورمضان" },
                  ].map(f => (
                    <button key={f.id} onClick={() => setTrendingFocus(f.id)}
                      className="px-3 py-1.5 rounded-lg text-sm font-medium transition-all"
                      style={trendingFocus === f.id
                        ? { background: "#A51C1C", color: "#fff", border: "1px solid #A51C1C" }
                        : { background: "#242424", color: "#808080", border: "1px solid #2E2E2E" }}>
                      {f.label}
                    </button>
                  ))}
                </div>
                <button onClick={loadTrending} disabled={trendingLoading}
                  className="w-full py-3 rounded-xl text-sm font-bold transition-all disabled:opacity-60"
                  style={{ background: "#A51C1C", color: "#fff" }}>
                  {trendingLoading
                    ? <span className="flex items-center justify-center gap-2">
                        <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        يجيب الأخبار ويحللها...
                      </span>
                    : "🔥 اجلب الأخبار وولّد الأفكار"}
                </button>
              </div>

              {!trendingResult && !trendingLoading && (
                <div className="text-center py-16 text-ink-muted">
                  <p className="text-4xl mb-3">🔥</p>
                  <p className="font-semibold text-ink-secondary">اضغط لتوليد أفكار ذكية</p>
                  <p className="text-sm mt-1">AI يحلل ما هو رائج الآن ويطابقه مع محتواك</p>
                </div>
              )}

              {trendingResult && (
                <div className="space-y-4">
                  {trendingResult._meta && (
                    <div className="rounded-xl px-4 py-3 flex items-center gap-3"
                      style={trendingResult._meta.hasRealData
                        ? { background: "#0D2016", border: "1px solid #1A4A2E" }
                        : { background: "#251D08", border: "1px solid #4A3A10" }}>
                      <span className="text-lg">{trendingResult._meta.hasRealData ? "✅" : "⚠️"}</span>
                      <div>
                        <p className="text-xs font-semibold" style={{ color: trendingResult._meta.hasRealData ? "#4ADE80" : "#D4A017" }}>
                          {trendingResult._meta.hasRealData
                            ? `أخبار حقيقية من: ${trendingResult._meta.sourcesFetched?.join(", ")}`
                            : "تعذّر الوصول للمصادر — النتائج مبنية على المعرفة العامة"}
                        </p>
                        <p className="text-xs text-ink-muted mt-0.5">
                          {new Date(trendingResult._meta.fetchedAt).toLocaleString("ar-JO", { dateStyle: "medium", timeStyle: "short" })}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Trending topics */}
                  {trendingResult.trendingTopics?.length > 0 && (
                    <div className="rounded-2xl p-4" style={{ background: "#1A1A1A", border: "1px solid #252525" }}>
                      <p className="text-xs font-semibold text-ink-muted uppercase tracking-widest mb-3">📡 مواضيع رائجة</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {trendingResult.trendingTopics.map((t: any, i: number) => (
                          <div key={i} className="rounded-xl p-3" style={{ background: "#242424" }}>
                            <div className="flex items-start justify-between gap-2 mb-1">
                              <p className="font-semibold text-ink-primary text-sm" dir="rtl">{t.topic}</p>
                              {t.source && (
                                <span className="text-xs text-ink-muted px-2 py-0.5 rounded-full shrink-0" style={{ background: "#2E2E2E" }}>{t.source}</span>
                              )}
                            </div>
                            <p className="text-xs mt-1" style={{ color: "#A51C1C" }} dir="rtl">{t.whyTrending}</p>
                            <p className="text-xs text-ink-muted mt-1.5 rounded-lg p-2" style={{ background: "#1A1A1A" }} dir="rtl">
                              <span className="font-semibold">زاوية Hesham:</span> {t.heshamAngle}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Quick wins */}
                  {trendingResult.quickWins?.length > 0 && (
                    <div className="rounded-2xl p-4" style={{ background: "#1A1A1A", border: "1px solid #252525" }}>
                      <p className="text-xs font-semibold text-ink-muted uppercase tracking-widest mb-3">⚡ أفكار سريعة</p>
                      <div className="space-y-2">
                        {trendingResult.quickWins.map((q: any, i: number) => (
                          <div key={i} className="flex items-start gap-3 rounded-xl p-3" style={{ background: "#0D2016", border: "1px solid #1A4A2E" }}>
                            <div className="flex-1">
                              <p className="font-semibold text-sm text-ink-primary" dir="rtl">{q.idea}</p>
                              <p className="text-xs text-ink-muted mt-0.5" dir="rtl">الهوك: {q.hook}</p>
                            </div>
                            <div className="flex flex-col gap-1 shrink-0 items-end">
                              <span className="text-xs px-2 py-1 rounded-full" style={{ background: "#1A4A2E", color: "#4ADE80" }}>{q.timeToFilm}</span>
                              <button
                                onClick={() => store.addIdea({ series: "other", vibe: "viral", hook: q.hook, script: q.idea, status: "idea", notes: `Quick win — ${q.timeToFilm}` })}
                                className="text-xs px-2 py-1 rounded-lg font-medium transition-colors"
                                style={{ background: "#A51C1C", color: "#fff" }}>
                                + حفظ
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Video ideas */}
                  {trendingResult.videoIdeas?.length > 0 && (
                    <div className="space-y-3">
                      <p className="text-xs font-semibold text-ink-muted uppercase tracking-widest">🎬 أفكار فيديو ({trendingResult.videoIdeas.length})</p>
                      {trendingResult.videoIdeas.map((idea: any) => (
                        <div key={idea.id} className="rounded-2xl p-4 space-y-3" style={{ background: "#1A1A1A", border: "1px solid #252525" }}>
                          <div className="flex items-start gap-2 flex-wrap">
                            <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "#242424", color: "#A0A0A0" }}>
                              {SERIES_LABELS[idea.series]?.icon} {SERIES_LABELS[idea.series]?.en}
                            </span>
                            <span className={clsx("text-xs", VIRAL_COLOR(idea.estimatedViralScore))}>
                              🔥 {idea.estimatedViralScore}/10
                            </span>
                          </div>
                          <p className="font-bold text-ink-primary" dir="rtl">{idea.title}</p>
                          <div className="rounded-lg px-3 py-2" style={{ background: "#3D0A0A", border: "1px solid #5A1414" }}>
                            <p className="text-xs font-semibold mb-0.5" style={{ color: "#FF8080" }}>الهوك</p>
                            <p className="text-sm font-medium text-ink-primary" dir="rtl">{idea.hook}</p>
                          </div>
                          <button onClick={() => setExpandedIdea(expandedIdea === idea.id ? null : idea.id)}
                            className="text-xs font-medium" style={{ color: "#A51C1C" }}>
                            {expandedIdea === idea.id ? "▲ أخفِ" : "▼ التفاصيل"}
                          </button>
                          {expandedIdea === idea.id && (
                            <div className="space-y-2">
                              <p className="text-sm text-ink-secondary rounded-lg p-3" style={{ background: "#242424" }} dir="rtl">{idea.concept}</p>
                              <p className="text-xs rounded-lg px-3 py-2" style={{ background: "#0D2016", color: "#4ADE80" }} dir="rtl">
                                ⏰ {idea.whyNow}
                              </p>
                            </div>
                          )}
                          <div className="flex gap-2">
                            <button onClick={() => saveTrendingIdea(idea)}
                              className="flex-1 py-2 rounded-lg text-xs font-bold transition-colors"
                              style={{ background: "#A51C1C", color: "#fff" }}>
                              + حفظ في البايبلاين
                            </button>
                            <button onClick={() => {
                              setScriptForm(f => ({ ...f, topic: idea.hook, series: idea.series, vibe: idea.vibe }))
                              setContentTab("script")
                            }}
                              className="px-3 py-2 rounded-lg text-xs font-medium transition-colors"
                              style={{ background: "#242424", color: "#A0A0A0", border: "1px solid #2E2E2E" }}>
                              ✍️ سكريبت
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── SCRIPT AI ────────────────────────────── */}
          {contentTab === "script" && (
            <div className="space-y-4">
              <div className="rounded-2xl p-5 space-y-4" style={{ background: "#1A1A1A", border: "1px solid #252525" }}>
                <div className="flex items-center gap-2">
                  <span className="text-2xl">✍️</span>
                  <div>
                    <h2 className="font-bold text-ink-primary">كاتب سكريبت احترافي</h2>
                    <p className="text-xs text-ink-muted">هوك، جسم، CTA، كابشن، هاشتاقات</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">السلسلة</label>
                    <select className="input" value={scriptForm.series} onChange={e => setScriptForm(f => ({ ...f, series: e.target.value as ContentSeries }))}>
                      {Object.entries(SERIES_LABELS).map(([k, v]) => <option key={k} value={k}>{v.icon} {v.en}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="label">نوع الفيديو</label>
                    <select className="input" value={scriptForm.vibe} onChange={e => setScriptForm(f => ({ ...f, vibe: e.target.value as ContentVibe }))}>
                      {Object.entries(VIBE_LABELS).map(([k, v]) => <option key={k} value={k}>{v.icon} {v.en}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="label">اللغة</label>
                    <select className="input" value={scriptForm.language} onChange={e => setScriptForm(f => ({ ...f, language: e.target.value }))}>
                      <option value="ar">عربي</option>
                      <option value="en">English</option>
                    </select>
                  </div>
                  {scriptForm.language === "ar" && (
                    <div>
                      <label className="label">اللهجة</label>
                      <select className="input" value={scriptForm.tone} onChange={e => setScriptForm(f => ({ ...f, tone: e.target.value }))}>
                        <option value="jordanian">🇯🇴 أردنية</option>
                        <option value="msa">📖 فصحى</option>
                        <option value="mixed">🇯🇴📖 مختلطة</option>
                      </select>
                    </div>
                  )}
                  <div className="col-span-2">
                    <label className="label">المدة</label>
                    <div className="flex gap-1">
                      {[30, 60, 90].map(d => (
                        <button key={d} onClick={() => setScriptForm(f => ({ ...f, duration: d }))}
                          className="flex-1 py-2 rounded-lg text-xs font-medium transition-all"
                          style={scriptForm.duration === d
                            ? { background: "#A51C1C", color: "#fff", border: "1px solid #A51C1C" }
                            : { background: "#242424", color: "#808080", border: "1px solid #2E2E2E" }}>
                          {d}s
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="col-span-2">
                    <label className="label">الموضوع / الفكرة</label>
                    <div className="flex gap-2">
                      <input className="input flex-1 text-sm" dir="auto"
                        placeholder="مثال: عنشي، قوانغتشو، سوق النمر..."
                        value={scriptForm.topic}
                        onChange={e => { setScriptForm(f => ({ ...f, topic: e.target.value })); setEnrichment(null) }}
                        onKeyDown={e => e.key === "Enter" && enrichTopic(scriptForm.topic)} />
                      <button onClick={() => enrichTopic(scriptForm.topic)}
                        disabled={enrichLoading || !scriptForm.topic.trim()}
                        className="px-3 py-2 rounded-lg text-xs font-medium transition-all shrink-0 disabled:opacity-40"
                        style={enrichment
                          ? { background: "#0D2016", color: "#4ADE80", border: "1px solid #1A4A2E" }
                          : { background: "#242424", color: "#A0A0A0", border: "1px solid #2E2E2E" }}>
                        {enrichLoading
                          ? <span className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin block" />
                          : enrichment ? "✅ مُعزَّز" : "🌐 بحث"}
                      </button>
                    </div>
                  </div>
                </div>

                {enrichment && (
                  <div className="rounded-xl p-3 space-y-2" style={{ background: "#0D2016", border: "1px solid #1A4A2E" }}>
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-bold" style={{ color: "#4ADE80" }}>✅ بيانات حقيقية جاهزة</p>
                      <button onClick={() => setEnrichment(null)} className="text-xs text-ink-muted hover:text-red-400">✕</button>
                    </div>
                    {enrichment.wiki?.summary && (
                      <p className="text-xs text-ink-muted line-clamp-2">{enrichment.wiki.summary}</p>
                    )}
                  </div>
                )}

                {enrichError && (
                  <div className="rounded-xl px-3 py-2" style={{ background: "#251D08", border: "1px solid #4A3A10" }}>
                    <p className="text-xs" style={{ color: "#D4A017" }}>⚠️ تعذّر جلب بيانات خارجية — السكريبت سيُكتب بدون تعزيز</p>
                  </div>
                )}

                <button onClick={generateScript} disabled={scriptLoading || !scriptForm.topic.trim()}
                  className="w-full py-3 rounded-xl text-sm font-bold transition-all disabled:opacity-40"
                  style={{ background: "#A51C1C", color: "#fff" }}>
                  {scriptLoading
                    ? <span className="flex items-center justify-center gap-2">
                        <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        جاري الكتابة...
                      </span>
                    : "✨ اكتب السكريبت"}
                </button>
              </div>

              {scriptResult && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <p className="font-semibold text-ink-primary">السكريبت جاهز 🎬</p>
                    <div className="flex gap-2">
                      <button onClick={saveScriptToIdea}
                        className="px-3 py-1.5 rounded-lg text-xs font-bold"
                        style={{ background: "#D4A017", color: "#0F0F0F" }}>
                        💾 حفظ في البايبلاين
                      </button>
                      <button onClick={() => copyText(`${scriptResult.hookAlternatives?.[activeHook] || scriptResult.hook}\n\n${scriptResult.body}\n\n${scriptResult.cta}`, "full")}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium"
                        style={{ background: "#242424", color: "#A0A0A0", border: "1px solid #2E2E2E" }}>
                        {copiedSection === "full" ? "✓ تم" : "📋 نسخ"}
                      </button>
                    </div>
                  </div>

                  {/* Hooks */}
                  <div className="rounded-2xl p-4" style={{ background: "#1A1A1A", border: "1px solid #252525" }}>
                    <p className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: "#A51C1C" }}>⚡ الهوك — اختار الأقوى</p>
                    <div className="space-y-2">
                      {[scriptResult.hook, ...(scriptResult.hookAlternatives || [])].filter(Boolean).map((h: string, i: number) => (
                        <button key={i} onClick={() => setActiveHook(i)}
                          className="w-full text-left rounded-xl px-4 py-3 text-sm font-medium transition-all"
                          style={activeHook === i
                            ? { background: "#3D0A0A", border: "2px solid #A51C1C", color: "#F0F0F0" }
                            : { background: "#242424", border: "2px solid #2E2E2E", color: "#808080" }}
                          dir="auto">
                          {i === 0 ? "🥇 " : i === 1 ? "🥈 " : "🥉 "}{h}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Body */}
                  <div className="rounded-2xl p-4" style={{ background: "#1A1A1A", border: "1px solid #252525" }}>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-bold text-ink-muted uppercase">📖 الجسم</p>
                      <button onClick={() => copyText(scriptResult.body, "body")} className="text-xs text-ink-muted hover:text-ink-secondary">
                        {copiedSection === "body" ? "✓" : "نسخ"}
                      </button>
                    </div>
                    <p className="text-sm text-ink-secondary whitespace-pre-wrap leading-relaxed" dir="auto">{scriptResult.body}</p>
                  </div>

                  {/* CTA */}
                  <div className="rounded-2xl p-4" style={{ background: "#1A1A1A", border: "1px solid #252525", borderLeft: "4px solid #D4A017" }}>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-bold uppercase" style={{ color: "#D4A017" }}>🎯 CTA</p>
                      <button onClick={() => copyText(scriptResult.cta, "cta")} className="text-xs text-ink-muted hover:text-ink-secondary">
                        {copiedSection === "cta" ? "✓" : "نسخ"}
                      </button>
                    </div>
                    <p className="text-sm text-ink-primary font-medium" dir="auto">{scriptResult.cta}</p>
                  </div>

                  {/* Caption */}
                  {scriptResult.caption && (
                    <div className="rounded-2xl p-4" style={{ background: "#1A1A1A", border: "1px solid #252525" }}>
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs font-bold text-ink-muted uppercase">📝 كابشن</p>
                        <button onClick={() => copyText(`${scriptResult.caption}\n\n${scriptResult.keywordHashtags?.join(" ")}`, "caption")}
                          className="text-xs text-ink-muted hover:text-ink-secondary">
                          {copiedSection === "caption" ? "✓ تم" : "نسخ"}
                        </button>
                      </div>
                      <p className="text-sm text-ink-secondary mb-3" dir="auto">{scriptResult.caption}</p>
                      {scriptResult.keywordHashtags?.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {scriptResult.keywordHashtags.map((h: string, i: number) => (
                            <span key={i} className="text-xs px-2 py-0.5 rounded-full" style={{ background: "#3D0A0A", color: "#FF8080" }}>{h}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── VOICEOVER ─────────────────────────────── */}
          {contentTab === "voiceover" && <VoiceoverStudio />}

          {/* ── PIPELINE ──────────────────────────────── */}
          {contentTab === "pipeline" && (
            <div className="space-y-3">
              <div className="flex gap-2 flex-wrap">
                <select className="input w-auto text-xs" value={filterSeries} onChange={e => setFilterSeries(e.target.value)}>
                  <option value="all">All Series</option>
                  {Object.entries(SERIES_LABELS).map(([k, v]) => <option key={k} value={k}>{v.icon} {v.en}</option>)}
                </select>
                <select className="input w-auto text-xs" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
                  <option value="all">All Status</option>
                  {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v.en}</option>)}
                </select>
                <button onClick={() => setShowIdeaForm(!showIdeaForm)}
                  className="ml-auto px-3 py-2 rounded-lg text-xs font-bold"
                  style={{ background: "#A51C1C", color: "#fff" }}>
                  ＋ Add Idea
                </button>
              </div>

              {showIdeaForm && (
                <div className="rounded-2xl p-4 space-y-3" style={{ background: "#1A1A1A", border: "1px solid #252525" }}>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="label">Series</label>
                      <select className="input" value={newIdea.series} onChange={e => setNewIdea(i => ({ ...i, series: e.target.value as ContentSeries }))}>
                        {Object.entries(SERIES_LABELS).map(([k, v]) => <option key={k} value={k}>{v.icon} {v.en}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="label">Vibe</label>
                      <select className="input" value={newIdea.vibe} onChange={e => setNewIdea(i => ({ ...i, vibe: e.target.value as ContentVibe }))}>
                        {Object.entries(VIBE_LABELS).map(([k, v]) => <option key={k} value={k}>{v.icon} {v.en}</option>)}
                      </select>
                    </div>
                    <div className="col-span-2">
                      <label className="label">Hook / Idea</label>
                      <input className="input" placeholder="الجملة الافتتاحية..." value={newIdea.hook}
                        onChange={e => setNewIdea(i => ({ ...i, hook: e.target.value }))} dir="auto" />
                    </div>
                    <div className="col-span-2">
                      <label className="label">Script</label>
                      <textarea className="input resize-none" rows={3} value={newIdea.script}
                        onChange={e => setNewIdea(i => ({ ...i, script: e.target.value }))} />
                    </div>
                    <div>
                      <label className="label">Status</label>
                      <select className="input" value={newIdea.status} onChange={e => setNewIdea(i => ({ ...i, status: e.target.value as ContentStatus }))}>
                        {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v.en}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="label">Notes</label>
                      <input className="input" value={newIdea.notes} onChange={e => setNewIdea(i => ({ ...i, notes: e.target.value }))} />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => {
                      if (newIdea.hook) {
                        store.addIdea(newIdea)
                        setNewIdea({ series: "city-series", hook: "", script: "", vibe: "viral", status: "idea", notes: "" })
                        setShowIdeaForm(false)
                      }
                    }} className="btn-primary">Save</button>
                    <button onClick={() => setShowIdeaForm(false)} className="btn-secondary">Cancel</button>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                {filteredIdeas.length === 0 ? (
                  <div className="text-center py-12 text-ink-muted">
                    <p className="text-3xl mb-2">🎬</p>
                    <p className="text-sm">No ideas yet — generate with Trending or Script AI</p>
                  </div>
                ) : filteredIdeas.map(idea => (
                  <div key={idea.id} className="rounded-xl p-3" style={{ background: "#1A1A1A", border: "1px solid #252525" }}>
                    <div className="flex items-start gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "#242424", color: "#A0A0A0" }}>
                            {SERIES_LABELS[idea.series]?.icon} {SERIES_LABELS[idea.series]?.en}
                          </span>
                        </div>
                        <p className="text-sm font-medium text-ink-primary" dir="auto">{idea.hook}</p>
                        {idea.notes && <p className="text-xs mt-1" style={{ color: "#D4A017" }}>💡 {idea.notes}</p>}
                      </div>
                      <div className="flex flex-col gap-1 shrink-0 items-end">
                        <select value={idea.status}
                          onChange={e => store.setIdeaStatus(idea.id, e.target.value as ContentStatus)}
                          className="text-xs px-2 py-0.5 rounded-full border-0 cursor-pointer"
                          style={{ background: "#2A2A2A", color: "#A0A0A0" }}>
                          {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v.en}</option>)}
                        </select>
                        <button onClick={() => store.deleteIdea(idea.id)} className="text-xs text-ink-muted hover:text-red-400">✕</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════════════ */}
      {/* COMPETITORS                                     */}
      {/* ════════════════════════════════════════════════ */}
      {tab === "competitors" && (
        <div className="space-y-4">
          {/* ── Scrape targets ──── */}
          <div className="rounded-2xl overflow-hidden" style={{ background: "#1A1A1A", border: "1px solid #252525" }}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-surface-border">
              <div>
                <p className="font-semibold text-ink-primary text-sm">Scrape Targets</p>
                <p className="text-xs text-ink-muted mt-0.5">Accounts & hashtags to monitor</p>
              </div>
              <button onClick={() => setShowAddTarget(!showAddTarget)}
                className="px-3 py-1.5 rounded-lg text-xs font-bold"
                style={{ background: "#A51C1C", color: "#fff" }}>
                + Add
              </button>
            </div>

            {showAddTarget && (
              <div className="px-4 py-3 border-b border-surface-border space-y-2">
                <div className="flex gap-2">
                  <select value={newTarget.type} onChange={e => setNewTarget(t => ({ ...t, type: e.target.value as "account" | "hashtag" }))}
                    className="input w-auto text-xs">
                    <option value="account">Account</option>
                    <option value="hashtag">Hashtag</option>
                  </select>
                  <input className="input flex-1 text-xs" placeholder={newTarget.type === "account" ? "anoodinchina" : "chinawithme"}
                    value={newTarget.target} onChange={e => setNewTarget(t => ({ ...t, target: e.target.value }))} />
                  <input className="input w-32 text-xs" placeholder="Label (optional)"
                    value={newTarget.label} onChange={e => setNewTarget(t => ({ ...t, label: e.target.value }))} />
                </div>
                <div className="flex gap-2">
                  <button onClick={addScrapeTarget} className="btn-primary text-xs py-1.5">Save</button>
                  <button onClick={() => setShowAddTarget(false)} className="btn-secondary text-xs py-1.5">Cancel</button>
                </div>
              </div>
            )}

            {scrapeLoading ? (
              <div className="p-8 text-center text-ink-muted text-sm">Loading targets…</div>
            ) : scrapeTargets.length === 0 ? (
              <div className="p-8 text-center text-ink-muted text-sm">No targets configured</div>
            ) : (
              <div className="divide-y divide-surface-border">
                {scrapeTargets.map(target => {
                  const lastResult = scrapeResults.find(r => r.target === target.target && r.type === target.type)
                  return (
                    <div key={target.id} className="flex items-center gap-3 px-4 py-3">
                      <span className="text-xs px-2 py-0.5 rounded-full shrink-0"
                        style={{ background: target.type === "account" ? "#0D2016" : "#251D08", color: target.type === "account" ? "#4ADE80" : "#D4A017" }}>
                        {target.type === "account" ? "@" : "#"}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-ink-primary truncate">
                          {target.type === "account" ? "@" : "#"}{target.target}
                          {target.label && <span className="text-ink-muted ml-2 text-xs">— {target.label}</span>}
                        </p>
                        {lastResult && (
                          <p className="text-xs text-ink-muted">
                            Last scraped: {new Date(lastResult.scraped_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}
                          </p>
                        )}
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer shrink-0">
                        <input type="checkbox" className="sr-only peer" checked={target.active}
                          onChange={e => toggleScrapeTarget(target.id, e.target.checked)} />
                        <div className="w-9 h-5 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:rounded-full after:h-4 after:w-4 after:transition-all"
                          style={{
                            background: target.active ? "#A51C1C" : "#2A2A2A",
                            border: "1px solid #3A3A3A",
                          }} />
                      </label>
                      <button onClick={() => deleteScrapeTarget(target.id)}
                        className="text-ink-muted hover:text-red-400 text-sm transition-colors shrink-0">✕</button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* ── Competitor analysis ── */}
          <div className="rounded-2xl p-5 space-y-4" style={{ background: "#1A1A1A", border: "1px solid #252525" }}>
            <div className="flex items-center gap-2">
              <span className="text-2xl">🔍</span>
              <div>
                <h2 className="font-bold text-ink-primary">تحليل المنافس</h2>
                <p className="text-xs text-ink-muted">أدخل الهاندل + الأرقام → AI يحلل ويعطيك خطة هجوم</p>
              </div>
            </div>

            <div>
              <label className="label">الهاندل</label>
              <div className="flex gap-2">
                <input className="input flex-1" placeholder="@anoodinchina" value={handle}
                  onChange={e => { setHandle(e.target.value); setCompetitorResult(null) }} />
                <a href={`https://www.instagram.com/${handle.replace("@", "")}/`}
                  target="_blank" rel="noopener"
                  className={clsx("px-3 py-2 rounded-lg text-xs font-medium", !handle.trim() && "opacity-40 pointer-events-none")}
                  style={{ background: "#242424", color: "#A0A0A0", border: "1px solid #2E2E2E" }}>
                  فتح ↗
                </a>
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold text-ink-muted uppercase tracking-wide mb-2">📋 أرقام يدوية</p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { key: "followers", label: "المتابعون", placeholder: "45K" },
                  { key: "posts", label: "المنشورات", placeholder: "120" },
                  { key: "avgViews", label: "متوسط مشاهدات", placeholder: "50K" },
                  { key: "following", label: "يتابع", placeholder: "500" },
                ].map(f => (
                  <div key={f.key}>
                    <label className="label">{f.label}</label>
                    <input className="input" placeholder={f.placeholder}
                      value={(manualProfile as any)[f.key]}
                      onChange={e => setManualProfile(p => ({ ...p, [f.key]: e.target.value }))} />
                  </div>
                ))}
                <div className="col-span-2">
                  <label className="label">البايو</label>
                  <input className="input" dir="auto" placeholder="انسخ البايو من الصفحة..."
                    value={manualProfile.bio} onChange={e => setManualProfile(p => ({ ...p, bio: e.target.value }))} />
                </div>
              </div>
            </div>

            <button onClick={analyzeCompetitor} disabled={competitorLoading || !handle.trim()}
              className="w-full py-3 rounded-xl text-sm font-bold transition-all disabled:opacity-40"
              style={{ background: "#A51C1C", color: "#fff" }}>
              {competitorLoading
                ? <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    جاري التحليل...
                  </span>
                : "🔍 حلّل المنافس"}
            </button>
          </div>

          {/* ── Competitor result ── */}
          {competitorResult && (
            <div className="space-y-3">
              {/* Profile card */}
              <div className="rounded-2xl p-4" style={{ background: "linear-gradient(135deg, #1A1A1A, #242424)", border: "1px solid #3A3A3A" }}>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold"
                    style={{ background: "#3A3A3A", color: "#F0F0F0" }}>
                    {handle.replace("@", "").charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-bold text-lg text-ink-primary">@{handle.replace("@", "")}</p>
                    {competitorResult.profileSummary?.bio && competitorResult.profileSummary.bio !== "لم يُحدَّد" && (
                      <p className="text-xs text-ink-muted mt-0.5 max-w-xs line-clamp-2" dir="auto">
                        {competitorResult.profileSummary.bio}
                      </p>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-2 text-center">
                  {[
                    { label: "متابعون", value: competitorResult.profileSummary?.followers },
                    { label: "منشورات", value: competitorResult.profileSummary?.postsCount },
                    { label: "avg views", value: competitorResult.profileSummary?.avgViews },
                    { label: "تفاعل", value: competitorResult.profileSummary?.engagementRate },
                  ].map((s, i) => (
                    <div key={i} className="rounded-xl p-2.5" style={{ background: "#2A2A2A" }}>
                      <p className="text-ink-muted text-xs mb-1">{s.label}</p>
                      <p className="font-bold text-sm" style={{ color: i === 0 ? "#D4A017" : "#F0F0F0" }}>
                        {s.value && s.value !== "لم يُحدَّد" ? s.value : "—"}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Inner tabs */}
              <div className="flex rounded-xl p-0.5" style={{ background: "#181818", border: "1px solid #252525" }}>
                {["overview", "gaps", "battleplan"].map(t => (
                  <button key={t} onClick={() => setCompetitorTab(t)}
                    className="flex-1 py-2 rounded-lg text-xs font-medium transition-colors"
                    style={competitorTab === t
                      ? { background: "#2E2E2E", color: "#F0F0F0" }
                      : { color: "#606060" }}>
                    {t === "overview" ? "نظرة عامة" : t === "gaps" ? "الفجوات" : "خطة الهجوم"}
                  </button>
                ))}
              </div>

              {competitorTab === "overview" && (
                <div className="space-y-3">
                  {competitorResult.topVideoThemes?.length > 0 && (
                    <div className="rounded-2xl p-4 space-y-2" style={{ background: "#1A1A1A", border: "1px solid #252525" }}>
                      <p className="text-xs font-semibold text-ink-muted uppercase tracking-widest">🎬 أكثر محتواه نجاحاً</p>
                      {competitorResult.topVideoThemes.map((t: any, i: number) => (
                        <div key={i} className="flex gap-3 rounded-xl p-3" style={{ background: "#242424" }}>
                          <span className="text-2xl font-black" style={{ color: "#3A3A3A" }}>0{i + 1}</span>
                          <div>
                            <p className="font-semibold text-sm text-ink-primary" dir="rtl">{t.theme}</p>
                            <p className="text-xs text-ink-muted mt-0.5" dir="rtl">{t.whyItWorks}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-2xl p-4" style={{ background: "#1A1A1A", border: "1px solid #252525" }}>
                      <p className="text-xs font-bold mb-2" style={{ color: "#4ADE80" }}>✅ نقاط قوته</p>
                      <ul className="space-y-1">
                        {competitorResult.strengths?.map((s: string, i: number) => (
                          <li key={i} className="text-xs text-ink-muted" dir="rtl">· {s}</li>
                        ))}
                      </ul>
                    </div>
                    <div className="rounded-2xl p-4" style={{ background: "#1A1A1A", border: "1px solid #252525" }}>
                      <p className="text-xs font-bold mb-2" style={{ color: "#FF6B6B" }}>⚠️ نقاط ضعفه</p>
                      <ul className="space-y-1">
                        {competitorResult.weaknesses?.map((w: string, i: number) => (
                          <li key={i} className="text-xs text-ink-muted" dir="rtl">· {w}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              {competitorTab === "gaps" && (
                <div className="rounded-2xl p-4 space-y-3" style={{ background: "#1A1A1A", border: "1px solid #252525" }}>
                  <p className="text-xs font-semibold text-ink-muted uppercase tracking-widest">🎯 فجوات تقدر تملأها</p>
                  {competitorResult.contentGaps?.map((g: any, i: number) => (
                    <div key={i} className="rounded-xl p-4" style={{ background: "#251D08", border: "1px solid #4A3A10" }}>
                      <p className="font-semibold text-sm text-ink-primary mb-1" dir="rtl">{g.gap}</p>
                      <p className="text-xs" style={{ color: "#D4A017" }} dir="rtl">💡 {g.opportunity}</p>
                    </div>
                  ))}
                </div>
              )}

              {competitorTab === "battleplan" && (
                <div className="space-y-3">
                  {competitorResult.battlePlan?.map((idea: any, i: number) => (
                    <div key={i} className="rounded-2xl p-4 space-y-3" style={{ background: "#1A1A1A", border: "1px solid #252525" }}>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "#242424", color: "#A0A0A0" }}>
                          {SERIES_LABELS[idea.series]?.icon} {SERIES_LABELS[idea.series]?.en}
                        </span>
                        {idea.urgency && URGENCY_COLOR[idea.urgency] && (
                          <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                            style={{ background: URGENCY_COLOR[idea.urgency].bg, color: URGENCY_COLOR[idea.urgency].text }}>
                            ⏰ {idea.urgency}
                          </span>
                        )}
                      </div>
                      <p className="font-bold text-ink-primary text-sm" dir="rtl">{idea.idea}</p>
                      <div className="rounded-lg px-3 py-2" style={{ background: "#3D0A0A", border: "1px solid #5A1414" }}>
                        <p className="text-xs font-semibold mb-0.5" style={{ color: "#FF8080" }}>الهوك</p>
                        <p className="text-sm text-ink-primary" dir="rtl">{idea.hook}</p>
                      </div>
                      <p className="text-xs rounded-lg px-3 py-2" style={{ background: "#0D2016", color: "#4ADE80" }} dir="rtl">
                        🏆 {idea.whyItBeats}
                      </p>
                      <div className="flex gap-2">
                        <button onClick={() => store.addIdea({ series: idea.series, vibe: idea.vibe || "viral", hook: idea.hook, script: idea.idea, status: "idea", notes: `من تحليل @${handle}` })}
                          className="flex-1 py-2 rounded-lg text-xs font-bold"
                          style={{ background: "#A51C1C", color: "#fff" }}>
                          + حفظ في البايبلاين
                        </button>
                        <button onClick={() => {
                          setScriptForm(f => ({ ...f, topic: idea.hook, series: idea.series, vibe: idea.vibe || "viral" }))
                          setTab("content")
                          setContentTab("script")
                        }}
                          className="px-3 py-2 rounded-lg text-xs font-medium"
                          style={{ background: "#242424", color: "#A0A0A0", border: "1px solid #2E2E2E" }}>
                          ✍️ سكريبت
                        </button>
                      </div>
                    </div>
                  ))}

                  {competitorResult.strategicInsight && (
                    <div className="rounded-2xl p-4" style={{ background: "#251D08", border: "1px solid #D4A01744" }}>
                      <p className="text-xs font-bold uppercase mb-1" style={{ color: "#D4A017" }}>🧠 الاستراتيجية الذكية</p>
                      <p className="text-sm font-medium text-ink-primary" dir="rtl">{competitorResult.strategicInsight}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
