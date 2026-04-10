"use client"
import { useState, useRef } from "react"
import { useStore } from "@/lib/store"
import { SERIES_LABELS, VIBE_LABELS, STATUS_LABELS } from "@/lib/constants"
import clsx from "clsx"
import type { ContentSeries, ContentVibe, ContentStatus } from "@/types"
import SocialSection from "./SocialSection"
import VoiceoverStudio from "./VoiceoverStudio"

const IG_TABS = [
  { id: "growth",     label: "Growth",     icon: "📈" },
  { id: "pipeline",   label: "Pipeline",   icon: "🎬" },
  { id: "trending",   label: "Trending",   icon: "🔥" },
  { id: "script",     label: "Script AI",  icon: "✍️" },
  { id: "voiceover",  label: "Voiceover",  icon: "🎙" },
  { id: "competitor", label: "Competitor", icon: "🔍" },
  { id: "image",      label: "Image AI",   icon: "🖼" },
]

const URGENCY_COLOR: Record<string, string> = {
  "عاجل": "bg-red-100 text-red-700",
  "هذا الأسبوع": "bg-yellow-100 text-yellow-700",
  "الشهر الجاي": "bg-green-100 text-green-700",
}

const VIRAL_COLOR = (score: number) => {
  if (score >= 8) return "text-green-600 font-bold"
  if (score >= 6) return "text-yellow-600 font-semibold"
  return "text-gray-500"
}

export default function InstagramSuite() {
  const store = useStore()
  const [tab, setTab] = useState("growth")

  // Pipeline
  const [filterSeries, setFilterSeries] = useState<string>("all")
  const [filterStatus, setFilterStatus] = useState<string>("all")
  const [showIdeaForm, setShowIdeaForm] = useState(false)
  const [newIdea, setNewIdea] = useState({ series: "city-series" as ContentSeries, hook: "", script: "", vibe: "viral" as ContentVibe, status: "idea" as ContentStatus, notes: "" })

  // Trending
  const [trendingFocus, setTrendingFocus] = useState("all")
  const [trendingResult, setTrendingResult] = useState<any>(null)
  const [trendingLoading, setTrendingLoading] = useState(false)
  const [expandedIdea, setExpandedIdea] = useState<number | null>(null)

  // Script
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

  // Competitor
  const [handle, setHandle] = useState("")
  const [competitorResult, setCompetitorResult] = useState<any>(null)
  const [competitorLoading, setCompetitorLoading] = useState(false)
  const [competitorTab, setCompetitorTab] = useState("overview")
  const [manualProfile, setManualProfile] = useState({
    followers: "", following: "", posts: "", bio: "", avgViews: "", niche: ""
  })

  // Image gen
  const [imageForm, setImageForm] = useState({ prompt: "", format: "1:1", style: "vivid" })
  const [imageResult, setImageResult] = useState<{ image: string; logo: string | null; format: string } | null>(null)
  const [imageLoading, setImageLoading] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const filteredIdeas = store.contentIdeas.filter(i => {
    if (filterSeries !== "all" && i.series !== filterSeries) return false
    if (filterStatus !== "all" && i.status !== filterStatus) return false
    return true
  })

  // ── API calls ──────────────────────────────────────────

  async function loadTrending() {
    setTrendingLoading(true)
    setTrendingResult(null)
    try {
      const res = await fetch("/api/trending-ideas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ focus: trendingFocus, date: new Date().toISOString().split("T")[0] })
      })
      const data = await res.json()
      setTrendingResult(data)
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
    } catch {
      setEnrichError(true)
    } finally {
      setEnrichLoading(false)
    }
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
      const data = await res.json()
      setScriptResult(data)
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
      const data = await res.json()
      setCompetitorResult(data)
    } catch {}
    setCompetitorLoading(false)
  }

  async function generateImage() {
    if (!imageForm.prompt.trim()) return
    setImageLoading(true)
    setImageResult(null)
    try {
      const res = await fetch("/api/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(imageForm)
      })
      const data = await res.json()
      setImageResult(data)
    } catch {}
    setImageLoading(false)
  }

  function copyText(text: string, key: string) {
    navigator.clipboard.writeText(text)
    setCopiedSection(key)
    setTimeout(() => setCopiedSection(null), 2000)
  }

  function saveScriptToIdea() {
    if (!scriptResult) return
    const hook = scriptResult.hookAlternatives ? scriptResult.hookAlternatives[activeHook] || scriptResult.hook : scriptResult.hook
    store.addIdea({
      series: scriptForm.series,
      vibe: scriptForm.vibe,
      status: "scripted",
      hook,
      script: `HOOK:\n${hook}\n\nBODY:\n${scriptResult.body}\n\nCTA:\n${scriptResult.cta}`,
      notes: scriptResult.filmingTips?.join(" | ") || "",
    })
    alert("✅ تم الحفظ في البايبلاين!")
  }

  function saveTrendingIdea(idea: any) {
    store.addIdea({
      series: idea.series,
      vibe: idea.vibe,
      hook: idea.hook,
      script: `CONCEPT:\n${idea.concept}\n\nTALKING POINTS:\n${idea.keyTalkingPoints?.join("\n")}`,
      status: "idea",
      notes: `Viral Score: ${idea.estimatedViralScore}/10 | ${idea.whyNow}`,
    })
  }

  function downloadWithLogo() {
    if (!imageResult || !canvasRef.current) return
    const canvas = canvasRef.current
    const ctx = canvas.getContext("2d")!
    const img = new Image()
    img.crossOrigin = "anonymous"
    img.onload = () => {
      canvas.width = img.width
      canvas.height = img.height
      ctx.drawImage(img, 0, 0)
      if (imageResult.logo) {
        const logo = new Image()
        logo.onload = () => {
          const lw = Math.min(200, canvas.width * 0.25)
          const lh = (logo.height / logo.width) * lw
          const pad = 20
          ctx.globalAlpha = 0.85
          ctx.drawImage(logo, canvas.width - lw - pad, canvas.height - lh - pad, lw, lh)
          ctx.globalAlpha = 1
          const link = document.createElement("a")
          link.href = canvas.toDataURL("image/png")
          link.download = `heshaminchina-${imageForm.format.replace(":", "x")}-${Date.now()}.png`
          link.click()
        }
        logo.src = imageResult.logo
      } else {
        const link = document.createElement("a")
        link.href = canvas.toDataURL("image/png")
        link.download = `heshaminchina-${Date.now()}.png`
        link.click()
      }
    }
    img.src = imageResult.image
  }

  // ── UI ─────────────────────────────────────────────────

  return (
    <div>
      <h1 className="text-xl font-bold mb-4">📱 Instagram Suite</h1>

      {/* Tab bar */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-5 overflow-x-auto">
        {IG_TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={clsx("flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all",
              tab === t.id ? "bg-white text-brand-red shadow-sm" : "text-gray-500 hover:text-gray-700"
            )}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* ── GROWTH ─────────────────────────────────────── */}
      {tab === "growth" && <SocialSection />}

      {/* ── PIPELINE ────────────────────────────────────── */}
      {tab === "pipeline" && (
        <div>
          <div className="flex gap-2 flex-wrap mb-4">
            <select className="input w-auto text-xs" value={filterSeries} onChange={e => setFilterSeries(e.target.value)}>
              <option value="all">All Series</option>
              {Object.entries(SERIES_LABELS).map(([k, v]) => <option key={k} value={k}>{v.icon} {v.en}</option>)}
            </select>
            <select className="input w-auto text-xs" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
              <option value="all">All Status</option>
              {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v.en}</option>)}
            </select>
            <button onClick={() => setShowIdeaForm(!showIdeaForm)} className="btn-primary ml-auto">＋ Add Idea</button>
          </div>

          {showIdeaForm && (
            <div className="card p-4 mb-4">
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div><label className="label">Series</label>
                  <select className="input" value={newIdea.series} onChange={e => setNewIdea(i => ({ ...i, series: e.target.value as ContentSeries }))}>
                    {Object.entries(SERIES_LABELS).map(([k, v]) => <option key={k} value={k}>{v.icon} {v.en}</option>)}
                  </select>
                </div>
                <div><label className="label">Vibe</label>
                  <select className="input" value={newIdea.vibe} onChange={e => setNewIdea(i => ({ ...i, vibe: e.target.value as ContentVibe }))}>
                    {Object.entries(VIBE_LABELS).map(([k, v]) => <option key={k} value={k}>{v.icon} {v.en}</option>)}
                  </select>
                </div>
                <div className="col-span-2"><label className="label">Hook / Idea</label>
                  <input className="input" placeholder="الجملة الافتتاحية أو الفكرة..." value={newIdea.hook} onChange={e => setNewIdea(i => ({ ...i, hook: e.target.value }))} />
                </div>
                <div className="col-span-2"><label className="label">Script</label>
                  <textarea className="input resize-none" rows={3} value={newIdea.script} onChange={e => setNewIdea(i => ({ ...i, script: e.target.value }))} />
                </div>
                <div><label className="label">Status</label>
                  <select className="input" value={newIdea.status} onChange={e => setNewIdea(i => ({ ...i, status: e.target.value as ContentStatus }))}>
                    {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v.en}</option>)}
                  </select>
                </div>
                <div><label className="label">Notes</label>
                  <input className="input" placeholder="ملاحظات..." value={newIdea.notes} onChange={e => setNewIdea(i => ({ ...i, notes: e.target.value }))} />
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => { if (newIdea.hook) { store.addIdea(newIdea); setNewIdea({ series: "city-series", hook: "", script: "", vibe: "viral", status: "idea", notes: "" }); setShowIdeaForm(false) } }} className="btn-primary">Save</button>
                <button onClick={() => setShowIdeaForm(false)} className="btn-secondary">Cancel</button>
              </div>
            </div>
          )}

          <div className="space-y-2">
            {filteredIdeas.length === 0 && <div className="card p-8 text-center text-gray-400"><p className="text-3xl mb-2">🎬</p><p>No ideas yet. Add one or generate with AI.</p></div>}
            {filteredIdeas.map(idea => (
              <div key={idea.id} className="card p-3">
                <div className="flex items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{SERIES_LABELS[idea.series]?.icon} {SERIES_LABELS[idea.series]?.en}</span>
                      <span className="text-xs bg-orange-50 text-orange-600 px-2 py-0.5 rounded-full">{VIBE_LABELS[idea.vibe]?.icon} {VIBE_LABELS[idea.vibe]?.en}</span>
                    </div>
                    <p className="text-sm font-medium text-gray-800" dir="auto">{idea.hook}</p>
                    {idea.notes && <p className="text-xs text-brand-gold mt-1">💡 {idea.notes}</p>}
                  </div>
                  <div className="flex flex-col gap-1 shrink-0">
                    <select value={idea.status}
                      onChange={e => store.setIdeaStatus(idea.id, e.target.value as ContentStatus)}
                      className={clsx("text-xs px-2 py-0.5 rounded-full border-0 cursor-pointer", STATUS_LABELS[idea.status]?.color)}>
                      {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v.en}</option>)}
                    </select>
                    <button onClick={() => store.deleteIdea(idea.id)} className="text-xs text-gray-200 hover:text-red-400">✕</button>
                  </div>
                </div>
                {idea.status === "posted" && (
                  <div className="flex gap-3 mt-2 border-t border-gray-100 pt-2">
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-gray-400">24h:</span>
                      <input type="number" className="w-20 text-xs border border-gray-200 rounded px-1.5 py-0.5" value={idea.views24h || ""} onChange={e => store.updateIdea(idea.id, { views24h: parseInt(e.target.value) || 0 })} />
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-gray-400">7d:</span>
                      <input type="number" className="w-20 text-xs border border-gray-200 rounded px-1.5 py-0.5" value={idea.views7d || ""} onChange={e => store.updateIdea(idea.id, { views7d: parseInt(e.target.value) || 0 })} />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── TRENDING IDEAS ──────────────────────────────── */}
      {tab === "trending" && (
        <div className="space-y-4">
          {/* Controls */}
          <div className="card p-4">
            <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
              <div>
                <h2 className="font-bold text-gray-900">🔥 أفكار من أخبار حقيقية</h2>
                <p className="text-xs text-gray-400 mt-0.5">يجيب أخبار الآن من BBC، SCMP، China Daily — ويحولها لأفكار فيديو</p>
              </div>
            </div>

            {/* Source badges */}
            <div className="flex flex-wrap gap-1 mb-3 mt-2">
              {["BBC", "SCMP", "China Daily", "Global Times", "NYT"].map(s => (
                <span key={s} className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{s}</span>
              ))}
              <span className="text-xs text-gray-400 px-1">← live RSS feeds</span>
            </div>

            <div className="flex flex-wrap gap-2 mb-4">
              {[
                { id: "all", label: "🌐 كل شي" },
                { id: "china", label: "🇨🇳 أخبار الصين" },
                { id: "business", label: "💼 توريد وتجارة" },
                { id: "travel", label: "✈️ سفر وتأشيرة" },
                { id: "trending", label: "📱 عالمي" },
                { id: "ramadan", label: "🌙 رمضان" },
              ].map(f => (
                <button key={f.id} onClick={() => setTrendingFocus(f.id)}
                  className={clsx("px-3 py-1.5 rounded-lg text-sm font-medium border transition-all",
                    trendingFocus === f.id
                      ? "bg-brand-red text-white border-brand-red"
                      : "bg-white text-gray-600 border-gray-200 hover:border-brand-red"
                  )}>{f.label}</button>
              ))}
            </div>
            <button onClick={loadTrending} disabled={trendingLoading}
              className="btn-primary w-full justify-center py-3">
              {trendingLoading
                ? <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />يجيب الأخبار ويحللها...</>
                : "🔥 اجلب الأخبار وولّد الأفكار"}
            </button>
          </div>

          {trendingResult && (
            <div className="space-y-4">
              {/* Sources used badge */}
              {trendingResult._meta && (
                <div className={clsx(
                  "rounded-xl px-4 py-3 flex items-center gap-3",
                  trendingResult._meta.hasRealData ? "bg-green-50 border border-green-200" : "bg-yellow-50 border border-yellow-200"
                )}>
                  <span className="text-lg">{trendingResult._meta.hasRealData ? "✅" : "⚠️"}</span>
                  <div>
                    <p className={clsx("text-xs font-semibold", trendingResult._meta.hasRealData ? "text-green-700" : "text-yellow-700")}>
                      {trendingResult._meta.hasRealData
                        ? `أخبار حقيقية من: ${trendingResult._meta.sourcesFetched?.join(", ")}`
                        : "تعذّر الوصول للمصادر — النتائج مبنية على المعرفة العامة"}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {new Date(trendingResult._meta.fetchedAt).toLocaleString("ar-JO", { dateStyle: "medium", timeStyle: "short" })}
                    </p>
                  </div>
                </div>
              )}

              {/* Trending topics */}
              {trendingResult.trendingTopics?.length > 0 && (
                <div className="card p-4">
                  <p className="section-title">📡 مواضيع رائجة من الأخبار</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {trendingResult.trendingTopics.map((t: any, i: number) => (
                      <div key={i} className="bg-gray-50 rounded-xl p-3">
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <p className="font-semibold text-gray-900 text-sm" dir="rtl">{t.topic}</p>
                          {t.source && (
                            <span className="text-xs bg-white border border-gray-200 text-gray-500 px-2 py-0.5 rounded-full shrink-0">{t.source}</span>
                          )}
                        </div>
                        <p className="text-xs text-brand-red mt-1" dir="rtl">{t.whyTrending}</p>
                        <p className="text-xs text-gray-500 mt-1.5 bg-white rounded-lg p-2" dir="rtl">
                          <span className="font-semibold">زاوية Hesham:</span> {t.heshamAngle}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Quick wins */}
              {trendingResult.quickWins?.length > 0 && (
                <div className="card p-4">
                  <p className="section-title">⚡ أفكار سريعة — تنجزها اليوم</p>
                  <div className="space-y-2">
                    {trendingResult.quickWins.map((q: any, i: number) => (
                      <div key={i} className="flex items-start gap-3 bg-green-50 rounded-xl p-3">
                        <div className="flex-1">
                          <p className="font-semibold text-sm text-gray-900" dir="rtl">{q.idea}</p>
                          <p className="text-xs text-gray-500 mt-0.5" dir="rtl">الهوك: {q.hook}</p>
                          {q.sourceEvent && (
                            <p className="text-xs text-green-600 mt-1 bg-white rounded-lg px-2 py-1" dir="rtl">
                              📰 {q.sourceEvent}
                            </p>
                          )}
                        </div>
                        <div className="flex flex-col gap-1 shrink-0 items-end">
                          <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">{q.timeToFilm}</span>
                          <button onClick={() => store.addIdea({ series: "other", vibe: "viral", hook: q.hook, script: q.idea, status: "idea", notes: `Quick win — ${q.timeToFilm}${q.sourceEvent ? ` | ${q.sourceEvent}` : ""}` })}
                            className="text-xs btn-primary py-1 px-2">+ حفظ</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Series idea */}
              {trendingResult.seriesIdea && (
                <div className="card p-4 border-l-4 border-brand-gold">
                  <div className="flex items-start justify-between mb-2">
                    <p className="section-title mb-0">💡 فكرة سلسلة جديدة</p>
                    <span className="text-xs bg-brand-cream text-brand-red px-2 py-0.5 rounded-full font-medium">سلسلة</span>
                  </div>
                  <p className="font-bold text-gray-900 text-base" dir="rtl">{trendingResult.seriesIdea.name}</p>
                  <p className="text-sm text-gray-600 mt-1" dir="rtl">{trendingResult.seriesIdea.concept}</p>
                  <p className="text-xs text-brand-gold font-medium mt-2" dir="rtl">📈 {trendingResult.seriesIdea.whyItWillGrow}</p>
                  <div className="mt-3 space-y-1">
                    {trendingResult.seriesIdea.episodes?.map((ep: string, i: number) => (
                      <p key={i} className="text-xs text-gray-600 bg-gray-50 rounded-lg px-3 py-1.5" dir="rtl">
                        <span className="font-semibold text-gray-400 ml-2">#{i + 1}</span> {ep}
                      </p>
                    ))}
                  </div>
                </div>
              )}

              {/* Video ideas */}
              <div>
                <p className="section-title">🎬 أفكار فيديو ({trendingResult.videoIdeas?.length})</p>
                <div className="space-y-3">
                  {trendingResult.videoIdeas?.map((idea: any) => (
                    <div key={idea.id} className="card p-4">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                              {SERIES_LABELS[idea.series]?.icon} {SERIES_LABELS[idea.series]?.en}
                            </span>
                            <span className="text-xs bg-orange-50 text-orange-600 px-2 py-0.5 rounded-full">
                              {VIBE_LABELS[idea.vibe]?.icon} {VIBE_LABELS[idea.vibe]?.en}
                            </span>
                            <span className={clsx("text-xs", VIRAL_COLOR(idea.estimatedViralScore))}>
                              🔥 {idea.estimatedViralScore}/10
                            </span>
                            <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">
                              {idea.productionDifficulty}
                            </span>
                          </div>
                          <p className="font-bold text-gray-900" dir="rtl">{idea.title}</p>
                          {/* Source event tag */}
                          {idea.sourceEvent && (
                            <p className="text-xs text-gray-400 mt-1 flex items-center gap-1" dir="rtl">
                              <span>📰</span> {idea.sourceEvent}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Hook */}
                      <div className="bg-brand-red/5 border border-brand-red/15 rounded-lg px-3 py-2 mb-2">
                        <p className="text-xs text-brand-red font-semibold mb-0.5">الهوك</p>
                        <p className="text-sm font-medium text-gray-900" dir="rtl">{idea.hook}</p>
                      </div>

                      {/* Concept - expandable */}
                      <button onClick={() => setExpandedIdea(expandedIdea === idea.id ? null : idea.id)}
                        className="text-xs text-brand-red hover:text-brand-red-dark font-medium mb-2 flex items-center gap-1">
                        {expandedIdea === idea.id ? "▲ أخفِ التفاصيل" : "▼ اعرض التفاصيل"}
                      </button>

                      {expandedIdea === idea.id && (
                        <div className="space-y-2 mb-2">
                          <p className="text-sm text-gray-700 bg-gray-50 rounded-lg p-3" dir="rtl">{idea.concept}</p>
                          {idea.keyTalkingPoints?.length > 0 && (
                            <div className="bg-gray-50 rounded-lg p-3">
                              <p className="text-xs font-semibold text-gray-500 mb-2">نقاط التحدث</p>
                              {idea.keyTalkingPoints.map((pt: string, i: number) => (
                                <p key={i} className="text-sm text-gray-700 flex gap-2" dir="rtl">
                                  <span className="text-brand-gold shrink-0">{i + 1}.</span> {pt}
                                </p>
                              ))}
                            </div>
                          )}
                          <p className="text-xs text-green-700 bg-green-50 rounded-lg px-3 py-2" dir="rtl">
                            ⏰ <span className="font-semibold">ليش الآن:</span> {idea.whyNow}
                          </p>
                          {idea.suggestedCaption && (
                            <div className="bg-blue-50 rounded-lg p-3">
                              <p className="text-xs font-semibold text-blue-600 mb-1">📝 كابشن مقترح</p>
                              <p className="text-xs text-gray-700" dir="rtl">{idea.suggestedCaption}</p>
                            </div>
                          )}
                          {idea.suggestedHashtags?.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {idea.suggestedHashtags.map((h: string, i: number) => (
                                <span key={i} className="text-xs bg-brand-cream text-brand-red px-2 py-0.5 rounded-full">{h}</span>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      <div className="flex gap-2">
                        <button onClick={() => saveTrendingIdea(idea)} className="btn-primary text-xs py-1.5 flex-1 justify-center">
                          + حفظ في البايبلاين
                        </button>
                        <button onClick={() => {
                          setScriptForm(f => ({ ...f, topic: idea.hook, series: idea.series as ContentSeries, vibe: idea.vibe as ContentVibe }))
                          setTab("script")
                        }} className="btn-secondary text-xs py-1.5">
                          ✍️ اكتب سكريبت
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {!trendingResult && !trendingLoading && (
            <div className="card p-12 text-center text-gray-400">
              <p className="text-5xl mb-3">🔥</p>
              <p className="font-semibold text-gray-600">اضغط لتوليد أفكار ذكية</p>
              <p className="text-sm mt-1">AI يحلل ما هو رائج الآن ويطابقه مع محتواك</p>
            </div>
          )}
        </div>
      )}

      {/* ── SCRIPT AI ───────────────────────────────────── */}
      {tab === "script" && (
        <div className="space-y-4">
          {/* Form */}
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-2xl">✍️</span>
              <div>
                <h2 className="font-bold text-gray-900">كاتب سكريبت احترافي</h2>
                <p className="text-xs text-gray-400">يكتب زي كاتب محتوى حقيقي — هوك، جسم، CTA، كابشن، هاشتاقات</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-4">
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
                    <option value="mixed">🇯🇴📖 أردنية + فصحى</option>
                  </select>
                </div>
              )}
              <div className={scriptForm.language === "ar" ? "col-span-2" : ""}>
                <label className="label">المدة المستهدفة</label>
                <div className="flex gap-1">
                  {[30, 60, 90].map(d => (
                    <button key={d} onClick={() => setScriptForm(f => ({ ...f, duration: d }))}
                      className={clsx("flex-1 py-2 rounded-lg text-xs font-medium border transition-colors",
                        scriptForm.duration === d ? "bg-brand-red text-white border-brand-red" : "bg-white text-gray-600 border-gray-200"
                      )}>{d}s</button>
                  ))}
                </div>
              </div>
              <div className="col-span-2">
                <label className="label">الموضوع / الفكرة</label>
                <div className="flex gap-2">
                  <input className="input flex-1 text-sm" dir="auto"
                    placeholder="مثال: عنشي، قوانغتشو، سوق النمر، مطاعم الإيغور..."
                    value={scriptForm.topic}
                    onChange={e => {
                      setScriptForm(f => ({ ...f, topic: e.target.value }))
                      setEnrichment(null)
                    }}
                    onKeyDown={e => e.key === "Enter" && enrichTopic(scriptForm.topic)} />
                  <button
                    onClick={() => enrichTopic(scriptForm.topic)}
                    disabled={enrichLoading || !scriptForm.topic.trim()}
                    title="اجلب معلومات حقيقية عن هذا الموضوع"
                    className={clsx("btn-secondary px-3 shrink-0 transition-all",
                      enrichment ? "border-green-400 text-green-600" : ""
                    )}>
                    {enrichLoading
                      ? <span className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                      : enrichment ? "✅ مُعزَّز" : "🌐 بحث"}
                  </button>
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  اضغط 🌐 بحث لجلب أماكن حقيقية، مطاعم، معالم — يُعزِّز السكريبت بمعلومات واقعية
                </p>
              </div>
            </div>

            {/* Enrichment preview */}
            {enrichment && (
              <div className="rounded-xl border border-green-200 bg-green-50 p-3 space-y-3 mb-2">
                {/* Header */}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-xs font-bold text-green-700 uppercase tracking-wide">
                      ✅ بيانات حقيقية جاهزة للسكريبت
                    </p>
                    {enrichment.sourceLabels?.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {enrichment.sourceLabels.map((s: string) => (
                          <span key={s} className="text-xs bg-white border border-green-200 text-green-700 px-1.5 py-0.5 rounded-full">{s}</span>
                        ))}
                      </div>
                    )}
                  </div>
                  <button onClick={() => setEnrichment(null)} className="text-xs text-gray-400 hover:text-red-400 shrink-0">✕</button>
                </div>

                {enrichment.wiki?.summary && (
                  <p className="text-xs text-gray-600 line-clamp-2 bg-white rounded-lg px-2 py-1.5">{enrichment.wiki.summary}</p>
                )}

                {/* Synthesized rich data */}
                {enrichment.synthesized ? (
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {enrichment.synthesized.topAttractions?.length > 0 && (
                      <div className="bg-white rounded-lg p-2">
                        <p className="font-semibold text-gray-500 mb-1">🏛 معالم ({enrichment.synthesized.topAttractions.length})</p>
                        <p className="text-gray-700 line-clamp-2">{enrichment.synthesized.topAttractions.map((a: any) => a.name).join("، ")}</p>
                      </div>
                    )}
                    {enrichment.synthesized.natureLandscapes?.length > 0 && (
                      <div className="bg-white rounded-lg p-2">
                        <p className="font-semibold text-gray-500 mb-1">⛰️ طبيعة وجبال ({enrichment.synthesized.natureLandscapes.length})</p>
                        <p className="text-gray-700 line-clamp-2">{enrichment.synthesized.natureLandscapes.map((n: any) => n.name).join("، ")}</p>
                      </div>
                    )}
                    {enrichment.synthesized.activities?.length > 0 && (
                      <div className="bg-white rounded-lg p-2">
                        <p className="font-semibold text-gray-500 mb-1">🧗 أنشطة ({enrichment.synthesized.activities.length})</p>
                        <p className="text-gray-700 line-clamp-2">{enrichment.synthesized.activities.map((a: any) => a.name).join("، ")}</p>
                      </div>
                    )}
                    {enrichment.synthesized.foodAndHalal?.length > 0 && (
                      <div className="bg-white rounded-lg p-2">
                        <p className="font-semibold text-gray-500 mb-1">🍜 أكل وحلال ({enrichment.synthesized.foodAndHalal.length})</p>
                        <p className="text-gray-700 line-clamp-2">{enrichment.synthesized.foodAndHalal.map((f: any) => f.name).join("، ")}</p>
                      </div>
                    )}
                    {enrichment.synthesized.shopping?.length > 0 && (
                      <div className="bg-white rounded-lg p-2">
                        <p className="font-semibold text-gray-500 mb-1">🛍 تسوق ({enrichment.synthesized.shopping.length})</p>
                        <p className="text-gray-700 line-clamp-2">{enrichment.synthesized.shopping.map((s: any) => s.name).join("، ")}</p>
                      </div>
                    )}
                    {enrichment.synthesized.hiddenGems?.length > 0 && (
                      <div className="bg-white rounded-lg p-2">
                        <p className="font-semibold text-gray-500 mb-1">💎 أماكن مخفية ({enrichment.synthesized.hiddenGems.length})</p>
                        <p className="text-gray-700 line-clamp-2">{enrichment.synthesized.hiddenGems.map((g: any) => g.name).join("، ")}</p>
                      </div>
                    )}
                    {enrichment.synthesized.whatPeopleSay?.length > 0 && (
                      <div className="bg-white rounded-lg p-2 col-span-2">
                        <p className="font-semibold text-gray-500 mb-1">💬 ماذا يقول المسافرون</p>
                        <p className="text-gray-600 italic line-clamp-2">"{enrichment.synthesized.whatPeopleSay[0]}"</p>
                      </div>
                    )}
                    {enrichment.synthesized.arabAngle && (
                      <div className="bg-brand-cream rounded-lg p-2 col-span-2">
                        <p className="font-semibold text-brand-red mb-0.5">🕌 للمسافر العربي المسلم</p>
                        <p className="text-gray-700 line-clamp-2">{enrichment.synthesized.arabAngle}</p>
                      </div>
                    )}
                  </div>
                ) : (
                  /* Fallback: raw OSM only */
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {enrichment.pois?.attractions?.length > 0 && (
                      <div className="bg-white rounded-lg p-2">
                        <p className="font-semibold text-gray-500 mb-1">🏛 معالم ({enrichment.pois.attractions.length})</p>
                        <p className="text-gray-700 line-clamp-2">{enrichment.pois.attractions.slice(0,5).join("، ")}</p>
                      </div>
                    )}
                    {enrichment.pois?.nature?.length > 0 && (
                      <div className="bg-white rounded-lg p-2">
                        <p className="font-semibold text-gray-500 mb-1">⛰️ طبيعة ({enrichment.pois.nature.length})</p>
                        <p className="text-gray-700 line-clamp-2">{enrichment.pois.nature.slice(0,5).join("، ")}</p>
                      </div>
                    )}
                  </div>
                )}

                {enrichment.coords?.province && (
                  <p className="text-xs text-green-600">📍 {enrichment.coords.province}، الصين</p>
                )}
              </div>
            )}

            {enrichError && (
              <div className="rounded-xl border border-yellow-200 bg-yellow-50 px-3 py-2 mb-2">
                <p className="text-xs text-yellow-700">⚠️ تعذّر جلب بيانات خارجية — السكريبت سيُكتب بدون تعزيز. يمكنك المحاولة مجدداً.</p>
              </div>
            )}

            <button onClick={generateScript} disabled={scriptLoading || !scriptForm.topic.trim()} className="btn-primary w-full justify-center py-3">
              {scriptLoading
                ? <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />جاري الكتابة...</>
                : "✨ اكتب السكريبت"}
            </button>
          </div>

          {/* Result */}
          {scriptResult && (
            <div className="space-y-3">
              {/* Header */}
              <div className="flex items-center justify-between">
                <p className="font-semibold text-gray-800">السكريبت جاهز 🎬</p>
                <div className="flex gap-2">
                  <button onClick={saveScriptToIdea} className="btn-gold text-xs py-1.5">💾 حفظ في البايبلاين</button>
                  <button onClick={() => copyText(
                    `${scriptResult.hookAlternatives?.[activeHook] || scriptResult.hook}\n\n${scriptResult.body}\n\n${scriptResult.cta}`,
                    "full"
                  )} className="btn-secondary text-xs py-1.5">
                    {copiedSection === "full" ? "✓ تم النسخ" : "📋 نسخ الكل"}
                  </button>
                </div>
              </div>

              {/* Hooks selection */}
              <div className="card p-4">
                <p className="text-xs font-bold text-brand-red uppercase tracking-wide mb-2">⚡ الهوك (0-3 ثوان) — اختار الأقوى</p>
                <div className="space-y-2">
                  {[scriptResult.hook, ...(scriptResult.hookAlternatives || [])].filter(Boolean).map((h: string, i: number) => (
                    <button key={i} onClick={() => setActiveHook(i)}
                      className={clsx("w-full text-left rounded-xl px-4 py-3 text-sm font-medium transition-all border-2",
                        activeHook === i
                          ? "border-brand-red bg-brand-red/5 text-gray-900"
                          : "border-gray-100 bg-gray-50 text-gray-600 hover:border-brand-red/40"
                      )} dir="auto">
                      {i === 0 ? "🥇 " : i === 1 ? "🥈 " : "🥉 "}{h}
                    </button>
                  ))}
                </div>
              </div>

              {/* Body */}
              <div className="card p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">📖 الجسم (3-{scriptForm.duration - 5}s)</p>
                  <button onClick={() => copyText(scriptResult.body, "body")}
                    className="text-xs text-gray-400 hover:text-brand-red">
                    {copiedSection === "body" ? "✓" : "نسخ"}
                  </button>
                </div>
                <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed" dir="auto">{scriptResult.body}</p>
              </div>

              {/* CTA */}
              <div className="card p-4 border-l-4 border-brand-gold">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-bold text-brand-gold uppercase tracking-wide">🎯 CTA ({scriptForm.duration - 5}-{scriptForm.duration}s)</p>
                  <button onClick={() => copyText(scriptResult.cta, "cta")}
                    className="text-xs text-gray-400 hover:text-brand-red">
                    {copiedSection === "cta" ? "✓" : "نسخ"}
                  </button>
                </div>
                <p className="text-sm text-gray-800 font-medium" dir="auto">{scriptResult.cta}</p>
              </div>

              {/* Filming tips */}
              {scriptResult.filmingTips?.length > 0 && (
                <div className="card p-4 bg-blue-50 border-blue-100">
                  <p className="text-xs font-bold text-blue-700 uppercase mb-2">🎥 نصائح التصوير</p>
                  <ul className="space-y-1">
                    {scriptResult.filmingTips.map((tip: string, i: number) => (
                      <li key={i} className="text-sm text-blue-800 flex gap-2" dir="auto">
                        <span className="text-blue-400 shrink-0">•</span> {tip}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Caption + Hashtags */}
              {scriptResult.caption && (
                <div className="card p-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-bold text-gray-500 uppercase">📝 كابشن جاهز للنشر</p>
                    <button onClick={() => copyText(
                      `${scriptResult.caption}\n\n${scriptResult.keywordHashtags?.join(" ")}`,
                      "caption"
                    )} className="text-xs text-gray-400 hover:text-brand-red">
                      {copiedSection === "caption" ? "✓ تم" : "نسخ"}
                    </button>
                  </div>
                  <p className="text-sm text-gray-800 mb-3" dir="auto">{scriptResult.caption}</p>
                  {scriptResult.keywordHashtags?.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {scriptResult.keywordHashtags.map((h: string, i: number) => (
                        <span key={i} className="text-xs bg-brand-cream text-brand-red px-2 py-0.5 rounded-full">{h}</span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Viral potential */}
              {scriptResult.viralPotential && (
                <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                  <p className="text-xs font-bold text-green-700 mb-1">📈 إمكانية الانتشار</p>
                  <p className="text-sm text-green-800" dir="auto">{scriptResult.viralPotential}</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── COMPETITOR ──────────────────────────────────── */}
      {tab === "competitor" && (
        <div className="space-y-4">

          {/* Input card */}
          <div className="card p-5 space-y-4">
            <div className="flex items-center gap-2">
              <span className="text-2xl">🔍</span>
              <div>
                <h2 className="font-bold text-gray-900">تحليل المنافس</h2>
                <p className="text-xs text-gray-400">أدخل الهاندل + الأرقام الحقيقية → AI يحلل ويعطيك خطة هجوم</p>
              </div>
            </div>

            {/* Handle */}
            <div>
              <label className="label">الهاندل</label>
              <div className="flex gap-2">
                <input className="input flex-1" placeholder="@anoodinchina" value={handle}
                  onChange={e => { setHandle(e.target.value); setCompetitorResult(null) }} />
                <a href={`https://www.instagram.com/${handle.replace("@","")}/`}
                  target="_blank" rel="noopener"
                  className={clsx("btn-secondary px-3 shrink-0", !handle.trim() && "opacity-40 pointer-events-none")}>
                  فتح ↗
                </a>
              </div>
            </div>

            {/* Manual profile data */}
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                📋 أدخل الأرقام يدوياً من الحساب — 30 ثانية، دقة 100%
              </p>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="label">المتابعون</label>
                  <input className="input" placeholder="مثال: 45,000 أو 45K"
                    value={manualProfile.followers}
                    onChange={e => setManualProfile(p => ({ ...p, followers: e.target.value }))} />
                </div>
                <div>
                  <label className="label">عدد المنشورات</label>
                  <input className="input" placeholder="مثال: 120"
                    value={manualProfile.posts}
                    onChange={e => setManualProfile(p => ({ ...p, posts: e.target.value }))} />
                </div>
                <div>
                  <label className="label">متوسط مشاهدات الريلز</label>
                  <input className="input" placeholder="مثال: 50K أو 200K"
                    value={manualProfile.avgViews}
                    onChange={e => setManualProfile(p => ({ ...p, avgViews: e.target.value }))} />
                </div>
                <div>
                  <label className="label">يتابع</label>
                  <input className="input" placeholder="مثال: 500"
                    value={manualProfile.following}
                    onChange={e => setManualProfile(p => ({ ...p, following: e.target.value }))} />
                </div>
                <div className="col-span-2">
                  <label className="label">البايو (انسخه من الحساب)</label>
                  <input className="input" dir="auto" placeholder="انسخ البايو من الصفحة الشخصية..."
                    value={manualProfile.bio}
                    onChange={e => setManualProfile(p => ({ ...p, bio: e.target.value }))} />
                </div>
                <div className="col-span-2">
                  <label className="label">نوع المحتوى (اختياري)</label>
                  <input className="input" dir="auto" placeholder="مثال: جولات مدن صينية، أكل، تسوق..."
                    value={manualProfile.niche}
                    onChange={e => setManualProfile(p => ({ ...p, niche: e.target.value }))} />
                </div>
              </div>
            </div>

            <button onClick={analyzeCompetitor}
              disabled={competitorLoading || !handle.trim()}
              className="btn-primary w-full justify-center py-3">
              {competitorLoading
                ? <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />جاري التحليل...</>
                : "🔍 حلّل المنافس"}
            </button>

            <p className="text-xs text-gray-400 text-center">
              Google Search يجلب سياق المحتوى — الأرقام اليدوية تضمن دقة التحليل
            </p>
          </div>

          {competitorResult && (
            <div className="space-y-3">
              {/* Profile summary card */}
              <div className="card p-4 bg-gradient-to-br from-gray-900 to-gray-700 text-white">
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-white/10 rounded-full flex items-center justify-center text-xl font-bold shrink-0">
                      {handle.replace("@","").charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-bold text-lg">@{handle.replace("@", "")}</p>
                      {competitorResult.profileSummary?.bio && competitorResult.profileSummary.bio !== "لم يُحدَّد" && (
                        <p className="text-white/60 text-xs mt-0.5 max-w-xs line-clamp-2" dir="auto">
                          {competitorResult.profileSummary.bio}
                        </p>
                      )}
                    </div>
                  </div>
                  <a href={`https://www.instagram.com/${handle.replace("@","")}/`}
                    target="_blank" rel="noopener"
                    className="text-xs bg-white/10 hover:bg-white/20 text-white px-3 py-1.5 rounded-lg shrink-0 transition-colors">
                    فتح ↗
                  </a>
                </div>

                {/* Stats grid */}
                <div className="grid grid-cols-4 gap-2 text-center">
                  {[
                    { label: "متابعون", value: competitorResult.profileSummary?.followers, highlight: true },
                    { label: "منشورات", value: competitorResult.profileSummary?.postsCount },
                    { label: "avg مشاهدات", value: competitorResult.profileSummary?.avgViews },
                    { label: "تفاعل", value: competitorResult.profileSummary?.engagementRate },
                  ].map((s, i) => (
                    <div key={i} className="bg-white/10 rounded-xl p-2.5">
                      <p className="text-white/40 text-xs mb-1">{s.label}</p>
                      <p className={clsx("font-bold text-sm", s.highlight ? "text-brand-gold" : "text-white")}>
                        {s.value && s.value !== "لم يُحدَّد" ? s.value : "—"}
                      </p>
                    </div>
                  ))}
                </div>

                {competitorResult.profileSummary?.contentStyle && (
                  <p className="text-white/60 text-xs mt-3 border-t border-white/10 pt-3" dir="rtl">
                    {competitorResult.profileSummary.contentStyle}
                  </p>
                )}
                <div className="flex items-center gap-2 mt-2">
                  {competitorResult._meta?.hasManual && (
                    <span className="text-xs bg-green-500/20 text-green-300 px-2 py-0.5 rounded-full">✓ أرقام يدوية</span>
                  )}
                  {competitorResult._meta?.hasSerper && (
                    <span className="text-xs bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded-full">✓ Google Search</span>
                  )}
                  {competitorResult._meta?.hasSocialBlade && (
                    <span className="text-xs bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded-full">✓ SocialBlade</span>
                  )}
                </div>
              </div>

              {/* Inner tabs */}
              <div className="flex bg-gray-100 rounded-lg p-0.5 w-fit">
                {["overview", "gaps", "battleplan"].map(t => (
                  <button key={t} onClick={() => setCompetitorTab(t)}
                    className={clsx("px-4 py-1.5 rounded-md text-xs font-medium transition-colors",
                      competitorTab === t ? "bg-white shadow text-gray-900" : "text-gray-500"
                    )}>
                    {t === "overview" ? "نظرة عامة" : t === "gaps" ? "الفجوات" : "خطة الهجوم"}
                  </button>
                ))}
              </div>

              {/* Overview */}
              {competitorTab === "overview" && (
                <div className="space-y-3">
                  {/* Top video themes */}
                  {competitorResult.topVideoThemes?.length > 0 && (
                    <div className="card p-4">
                      <p className="section-title">🎬 أكثر محتواه نجاحاً</p>
                      <div className="space-y-2">
                        {competitorResult.topVideoThemes.map((t: any, i: number) => (
                          <div key={i} className="flex gap-3 bg-gray-50 rounded-xl p-3">
                            <span className="text-2xl font-black text-gray-200">0{i+1}</span>
                            <div>
                              <p className="font-semibold text-sm text-gray-900" dir="rtl">{t.theme}</p>
                              <p className="text-xs text-gray-500 mt-0.5" dir="rtl">{t.whyItWorks}</p>
                              {t.estimatedViews && <p className="text-xs text-brand-gold mt-0.5">📊 {t.estimatedViews}</p>}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Strengths & Weaknesses */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="card p-4">
                      <p className="text-xs font-bold text-green-600 uppercase mb-2">✅ نقاط قوته</p>
                      <ul className="space-y-1">
                        {competitorResult.strengths?.map((s: string, i: number) => (
                          <li key={i} className="text-xs text-gray-700" dir="rtl">· {s}</li>
                        ))}
                      </ul>
                    </div>
                    <div className="card p-4">
                      <p className="text-xs font-bold text-red-500 uppercase mb-2">⚠️ نقاط ضعفه</p>
                      <ul className="space-y-1">
                        {competitorResult.weaknesses?.map((w: string, i: number) => (
                          <li key={i} className="text-xs text-gray-700" dir="rtl">· {w}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              {/* Gaps */}
              {competitorTab === "gaps" && (
                <div className="card p-4">
                  <p className="section-title">🎯 فجوات تقدر تملأها</p>
                  <div className="space-y-3">
                    {competitorResult.contentGaps?.map((g: any, i: number) => (
                      <div key={i} className="border border-orange-100 bg-orange-50 rounded-xl p-4">
                        <p className="font-semibold text-sm text-gray-900 mb-1" dir="rtl">{g.gap}</p>
                        <p className="text-xs text-orange-700" dir="rtl">💡 {g.opportunity}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Battle plan */}
              {competitorTab === "battleplan" && (
                <div className="space-y-3">
                  {competitorResult.battlePlan?.map((idea: any, i: number) => (
                    <div key={i} className="card p-4">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                          {SERIES_LABELS[idea.series]?.icon} {SERIES_LABELS[idea.series]?.en}
                        </span>
                        {idea.urgency && (
                          <span className={clsx("text-xs px-2 py-0.5 rounded-full font-medium", URGENCY_COLOR[idea.urgency] || "bg-gray-100 text-gray-600")}>
                            ⏰ {idea.urgency}
                          </span>
                        )}
                      </div>
                      <p className="font-bold text-gray-900 text-sm" dir="rtl">{idea.idea}</p>
                      <div className="bg-brand-red/5 border border-brand-red/15 rounded-lg px-3 py-2 my-2">
                        <p className="text-xs text-brand-red font-semibold mb-0.5">الهوك</p>
                        <p className="text-sm" dir="rtl">{idea.hook}</p>
                      </div>
                      <p className="text-xs text-green-700 bg-green-50 rounded-lg px-3 py-2 mb-2" dir="rtl">
                        🏆 {idea.whyItBeats}
                      </p>
                      <div className="flex gap-2">
                        <button onClick={() => { store.addIdea({ series: idea.series, vibe: idea.vibe || "viral", hook: idea.hook, script: idea.idea, status: "idea", notes: `من تحليل @${handle}. ليش يتفوق: ${idea.whyItBeats}` }) }}
                          className="btn-primary text-xs py-1.5 flex-1 justify-center">+ حفظ في البايبلاين</button>
                        <button onClick={() => {
                          setScriptForm(f => ({ ...f, topic: idea.hook, series: idea.series as ContentSeries, vibe: (idea.vibe || "viral") as ContentVibe }))
                          setTab("script")
                        }} className="btn-secondary text-xs py-1.5">✍️ سكريبت</button>
                      </div>
                    </div>
                  ))}

                  {/* Strategic insight */}
                  {competitorResult.strategicInsight && (
                    <div className="card p-4 bg-brand-cream border-brand-gold border">
                      <p className="text-xs font-bold text-brand-gold uppercase mb-1">🧠 الاستراتيجية الذكية</p>
                      <p className="text-sm text-gray-800 font-medium" dir="rtl">{competitorResult.strategicInsight}</p>
                    </div>
                  )}
                  {competitorResult.watchOut && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
                      <p className="text-xs font-bold text-yellow-700 uppercase mb-1">⚠️ انتبه لهذا</p>
                      <p className="text-sm text-yellow-800" dir="rtl">{competitorResult.watchOut}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── VOICEOVER ───────────────────────────────────── */}
      {tab === "voiceover" && <VoiceoverStudio />}

      {/* ── IMAGE AI ────────────────────────────────────── */}
      {tab === "image" && (
        <div className="space-y-4">
          <div className="card p-5">
            <h2 className="font-semibold text-gray-800 mb-4">🖼 AI Image Generator</h2>
            <div className="space-y-3">
              <div>
                <label className="label">Prompt</label>
                <textarea className="input resize-none" rows={3}
                  placeholder="e.g. Aerial view of Guangzhou city at golden hour, modern skyline, warm colors"
                  value={imageForm.prompt} onChange={e => setImageForm(f => ({ ...f, prompt: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Format</label>
                  <select className="input" value={imageForm.format} onChange={e => setImageForm(f => ({ ...f, format: e.target.value }))}>
                    <option value="9:16">9:16 — Reel / Story</option>
                    <option value="1:1">1:1 — Square</option>
                    <option value="16:9">16:9 — Landscape</option>
                    <option value="4:5">4:5 — Portrait</option>
                  </select>
                </div>
                <div>
                  <label className="label">Style</label>
                  <select className="input" value={imageForm.style} onChange={e => setImageForm(f => ({ ...f, style: e.target.value }))}>
                    <option value="vivid">Vivid (dramatic)</option>
                    <option value="natural">Natural (realistic)</option>
                  </select>
                </div>
              </div>
              <button onClick={generateImage} disabled={imageLoading || !imageForm.prompt} className="btn-primary w-full justify-center">
                {imageLoading ? <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Generating...</> : "✨ Generate Image"}
              </button>
            </div>
          </div>

          {imageResult && (
            <div className="card p-4">
              <img src={imageResult.image} alt="Generated" className="w-full rounded-lg mb-3" />
              <p className="text-xs text-gray-400 mb-3">Logo overlaid on download (bottom-right)</p>
              <canvas ref={canvasRef} className="hidden" />
              <div className="flex gap-2">
                <button onClick={downloadWithLogo} className="btn-primary flex-1 justify-center">⬇ Download with Logo</button>
                <button onClick={() => { const a = document.createElement("a"); a.href = imageResult.image; a.download = "image.png"; a.click() }} className="btn-secondary">No logo</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
