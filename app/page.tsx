"use client"
import { useState, useEffect } from "react"
import { useStore } from "@/lib/store"
import { ARABIC_QUOTES, CHENGYU, DEAL_STATUS_LABELS } from "@/lib/constants"
import { v4 as uuid } from "uuid"
import clsx from "clsx"
import type { DealStream, DealStatus, ProjectHealth, AffiliateCat } from "@/types"
import SocialSection from "@/components/dashboard/SocialSection"
import InstagramSuite from "@/components/dashboard/InstagramSuite"
import ProjectsHub from "@/components/dashboard/ProjectsHub"
import ContactsCRM from "@/components/dashboard/ContactsCRM"
import Journal from "@/components/dashboard/Journal"
import FinanceHub from "@/components/dashboard/FinanceHub"
import ContentCalendar from "@/components/dashboard/ContentCalendar"
import FootageVault from "@/components/dashboard/FootageVault"
import DailyBrief from "@/components/dashboard/DailyBrief"
import { useHydrate } from "@/lib/useHydrate"
import { LineChart, Line, ResponsiveContainer, Tooltip } from "recharts"

// ── Nav items ──────────────────────────────────────────
const NAV = [
  { id: "home",      label: "Home",      icon: "⊞" },
  { id: "vault",     label: "Footage",   icon: "🎥" },
  { id: "instagram", label: "Instagram", icon: "📱" },
  { id: "calendar",  label: "Calendar",  icon: "📅" },
  { id: "contacts",  label: "Contacts",  icon: "👥" },
  { id: "finance",   label: "Finance",   icon: "💰" },
  { id: "journal",   label: "Journal",   icon: "📔" },
  { id: "projects",  label: "Projects",  icon: "🚀" },
  { id: "links",     label: "Links",     icon: "🔗" },
]

// Mobile nav shows only key 5 tabs
const MOBILE_NAV = ["home", "vault", "instagram", "finance", "journal"]

// ── Today helpers ──────────────────────────────────────
const todayStr = () => new Date().toISOString().split("T")[0]
const getQuote = () => ARABIC_QUOTES[new Date().getDate() % ARABIC_QUOTES.length]
const getChengyu = () => CHENGYU[new Date().getDate() % CHENGYU.length]
const thisMonday = () => {
  const d = new Date()
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  return new Date(new Date().setDate(diff)).toISOString().split("T")[0]
}

export default function Dashboard() {
  useHydrate()
  const store = useStore()
  const [tab, setTab] = useState("home")
  const [weather, setWeather] = useState<{ temp: string | number; emoji: string; description: string } | null>(null)
  const [brief, setBrief] = useState("")
  const [briefLoading, setBriefLoading] = useState(false)
  const [newTask, setNewTask] = useState("")
  const [newDeal, setNewDeal] = useState({ client: "", stream: "sourcing" as DealStream, status: "lead" as DealStatus, value: 0, currency: "USD", nextAction: "" })
  const [showDealForm, setShowDealForm] = useState(false)
  const [dealLogId, setDealLogId] = useState<string | null>(null)
  const [dealLogNote, setDealLogNote] = useState("")
  const [newGoal, setNewGoal] = useState("")
  const [newCapture, setNewCapture] = useState("")
  const [showCapture, setShowCapture] = useState(false)
  const [newLink, setNewLink] = useState({ title: "", url: "", category: "hotel" as AffiliateCat, commission: "" })
  const [showLinkForm, setShowLinkForm] = useState(false)
  const [revenueTarget, setRevenueTarget] = useState(false)

  // Mark check-in
  useEffect(() => {
    store.markCheckinToday()
    fetch("/api/weather").then(r => r.json()).then(setWeather).catch(() => {})
  }, [])

  const quote = getQuote()
  const chengyu = getChengyu()
  const focus = store.dailyFocus?.date === todayStr() ? store.dailyFocus : null
  const weekGoals = store.weeklyGoals.filter(g => g.weekStart === thisMonday())

  // Safe sum — guards against NaN from null/undefined values
  const safeSum = (arr: any[], key: string) =>
    arr.reduce((s, d) => s + (isNaN(Number(d[key])) ? 0 : Number(d[key])), 0)

  // Revenue calcs
  const now = new Date()
  const paidThisMonth = safeSum(
    store.deals.filter(d => d.status === "paid" && new Date(d.updatedAt).getMonth() === now.getMonth() && new Date(d.updatedAt).getFullYear() === now.getFullYear()),
    "value"
  )
  const openPipeline = safeSum(store.deals.filter(d => d.status !== "paid"), "value")
  const target = store.revenueSettings.monthlyTarget || 1
  const pct = Math.min(100, Math.round((paidThisMonth / target) * 100))

  const staleDeals = store.deals.filter(d => {
    if (d.status === "paid") return false
    const days = (Date.now() - new Date(d.updatedAt).getTime()) / 86400000
    return days >= store.revenueSettings.staleAlertDays
  })

  async function getMorningBrief() {
    setBriefLoading(true)
    try {
      const res = await fetch("/api/morning-brief", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deals: store.deals,
          projects: store.projects,
          followerLog: store.followerLog,
          streaks: store.streaks,
          weeklyGoals: store.weeklyGoals,
          dailyFocus: store.dailyFocus,
        })
      })
      const data = await res.json()
      setBrief(data.brief || "")
    } catch {}
    setBriefLoading(false)
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20 lg:pb-0">
      {/* Desktop sidebar + mobile top bar */}
      <div className="lg:flex">

        {/* Sidebar (desktop) */}
        <aside className="hidden lg:flex flex-col w-60 bg-brand-red min-h-screen fixed left-0 top-0 z-40">
          <div className="p-5 border-b border-white/10">
            <img src="/logo.png" alt="HeshamChina" className="h-10 object-contain" />
            <p className="text-white/50 text-xs mt-1.5 text-center tracking-widest uppercase">Command Center</p>
          </div>
          <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
            {/* Main */}
            {[
              { id: "home", label: "Home", icon: "⊞" },
            ].map(n => (
              <button key={n.id} onClick={() => setTab(n.id)}
                className={clsx("w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all text-left",
                  tab === n.id ? "bg-white/20 text-white shadow-inner" : "text-white/70 hover:bg-white/10 hover:text-white"
                )}>
                <span className="text-base">{n.icon}</span>{n.label}
              </button>
            ))}
            <div className="pt-2 pb-1 px-3">
              <p className="text-white/30 text-xs uppercase tracking-widest font-semibold">Content</p>
            </div>
            {[
              { id: "vault",     label: "Footage Vault", icon: "🎥" },
              { id: "instagram", label: "Instagram",     icon: "📱" },
              { id: "calendar",  label: "Calendar",      icon: "📅" },
            ].map(n => (
              <button key={n.id} onClick={() => setTab(n.id)}
                className={clsx("w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all text-left",
                  tab === n.id ? "bg-white/20 text-white shadow-inner" : "text-white/70 hover:bg-white/10 hover:text-white"
                )}>
                <span className="text-base">{n.icon}</span>{n.label}
              </button>
            ))}
            <div className="pt-2 pb-1 px-3">
              <p className="text-white/30 text-xs uppercase tracking-widest font-semibold">Business</p>
            </div>
            {[
              { id: "contacts", label: "Contacts", icon: "👥" },
              { id: "finance", label: "Finance", icon: "💰" },
              { id: "projects", label: "Projects", icon: "🚀" },
            ].map(n => (
              <button key={n.id} onClick={() => setTab(n.id)}
                className={clsx("w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all text-left",
                  tab === n.id ? "bg-white/20 text-white shadow-inner" : "text-white/70 hover:bg-white/10 hover:text-white"
                )}>
                <span className="text-base">{n.icon}</span>{n.label}
              </button>
            ))}
            <div className="pt-2 pb-1 px-3">
              <p className="text-white/30 text-xs uppercase tracking-widest font-semibold">Personal</p>
            </div>
            {[
              { id: "journal", label: "Journal", icon: "📔" },
              { id: "links", label: "Links", icon: "🔗" },
            ].map(n => (
              <button key={n.id} onClick={() => setTab(n.id)}
                className={clsx("w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all text-left",
                  tab === n.id ? "bg-white/20 text-white shadow-inner" : "text-white/70 hover:bg-white/10 hover:text-white"
                )}>
                <span className="text-base">{n.icon}</span>{n.label}
              </button>
            ))}
          </nav>
          <div className="p-4 border-t border-white/10 text-center">
            <p className="text-white/30 text-xs">heshamchina.com</p>
          </div>
        </aside>

        {/* Main */}
        <main className="flex-1 lg:ml-60 p-4 lg:p-6 max-w-5xl">

          {/* ── HOME TAB ───────────────────────────── */}
          {tab === "home" && (
            <div className="space-y-4">

              {/* Smart Daily Brief */}
              <DailyBrief onNavigate={setTab} />

              {/* Quote + 成语 row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="card p-3 border-l-4 border-gray-200">
                  <p className="text-gray-700 font-medium text-sm text-right leading-relaxed" dir="rtl">«{quote.ar}»</p>
                  <p className="text-gray-400 text-xs mt-1">{quote.en}</p>
                </div>
                <div className="card p-3 border-l-4 border-brand-gold">
                  <p className="text-gray-900 font-bold text-lg">{chengyu.zh}</p>
                  <p className="text-gray-500 text-xs">{chengyu.pinyin} — {chengyu.meaning}</p>
                </div>
              </div>

              {/* ── 2-col: Today's Focus + Streaks ── */}
              <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">

                {/* Today's Focus — wider col */}
                <div className="lg:col-span-3 card p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="text-base font-bold text-gray-800">🎯 Today's Focus</h2>
                    <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{todayStr()}</span>
                  </div>
                  <input
                    className="input text-sm font-medium mb-3"
                    placeholder="What's your #1 mission today?"
                    value={focus?.mainMission || ""}
                    onChange={e => store.setMainMission(e.target.value)}
                  />
                  <div className="space-y-1.5">
                    {focus?.checklist.map(item => (
                      <div key={item.id} className="flex items-center gap-2 group px-1">
                        <input type="checkbox" checked={item.done}
                          onChange={() => store.toggleChecklistItem(item.id)}
                          className="rounded border-gray-300 text-brand-red w-4 h-4 shrink-0" />
                        <span className={clsx("flex-1 text-sm", item.done && "line-through text-gray-300")}>{item.text}</span>
                        <button onClick={() => store.deleteChecklistItem(item.id)}
                          className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400 text-xs">✕</button>
                      </div>
                    ))}
                    {(focus?.checklist.length ?? 0) > 0 && (
                      <p className="text-xs text-gray-400 pl-1">
                        {focus!.checklist.filter(i => i.done).length}/{focus!.checklist.length} done
                        {focus!.checklist.every(i => i.done) && focus!.checklist.length > 0 && <span className="text-green-500 font-semibold ml-1">✓ All done!</span>}
                      </p>
                    )}
                    <div className="flex gap-2 mt-2">
                      <input className="input flex-1 text-sm" placeholder="Add task..." value={newTask}
                        onChange={e => setNewTask(e.target.value)}
                        onKeyDown={e => { if (e.key === "Enter" && newTask.trim()) { store.addChecklistItem(newTask.trim()); setNewTask("") } }} />
                      <button onClick={() => { if (newTask.trim()) { store.addChecklistItem(newTask.trim()); setNewTask("") } }}
                        className="btn-secondary px-3" aria-label="Add task">＋</button>
                    </div>
                  </div>
                </div>

                {/* Streaks + Quick Capture — narrower col */}
                <div className="lg:col-span-2 space-y-3">
                  {/* Streaks */}
                  <div className="card p-4">
                    <h2 className="text-base font-bold text-gray-800 mb-3">🔥 Streaks</h2>
                    <div className="grid grid-cols-2 gap-2 mb-3">
                      <div className="text-center bg-orange-50 rounded-xl p-3">
                        <p className="text-3xl font-black text-orange-500">{store.streaks.postingStreak}</p>
                        <p className="text-xs text-gray-500 mt-1">Posting days</p>
                      </div>
                      <div className="text-center bg-green-50 rounded-xl p-3">
                        <p className="text-3xl font-black text-green-600">{store.streaks.checkinStreak}</p>
                        <p className="text-xs text-gray-500 mt-1">Check-ins</p>
                      </div>
                    </div>
                    <button onClick={store.markPostedToday} aria-label="Mark posted today"
                      className={clsx("w-full py-2 rounded-lg text-sm font-medium transition-colors",
                        store.streaks.lastPostedDate === todayStr()
                          ? "bg-green-100 text-green-700 cursor-default"
                          : "bg-orange-500 hover:bg-orange-600 text-white"
                      )}>
                      {store.streaks.lastPostedDate === todayStr() ? "✓ Posted today!" : "📸 Mark Posted Today"}
                    </button>
                  </div>

                  {/* Quick Capture */}
                  <div className="card p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h2 className="text-base font-bold text-gray-800">💡 Capture</h2>
                      {store.captures.filter(c => !c.processed).length > 0 && (
                        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                          {store.captures.filter(c => !c.processed).length} pending
                        </span>
                      )}
                    </div>
                    <div className="flex gap-2 mb-2">
                      <input className="input flex-1 text-sm" placeholder="Idea, task, thought..." value={newCapture}
                        onChange={e => setNewCapture(e.target.value)}
                        onKeyDown={e => { if (e.key === "Enter" && newCapture.trim()) { store.addCapture(newCapture.trim()); setNewCapture("") } }} />
                      <button onClick={() => { if (newCapture.trim()) { store.addCapture(newCapture.trim()); setNewCapture("") } }}
                        className="btn-primary px-3" aria-label="Add capture">＋</button>
                    </div>
                    <div className="space-y-1 max-h-32 overflow-y-auto">
                      {store.captures.filter(c => !c.processed).slice(0, 6).map(c => (
                        <div key={c.id} className="flex items-center gap-2 text-xs group">
                          <span className="flex-1 text-gray-700 truncate">{c.text}</span>
                          <button onClick={() => store.processCapture(c.id)} className="opacity-0 group-hover:opacity-100 text-green-500 hover:text-green-700 shrink-0" aria-label="Mark done">✓</button>
                          <button onClick={() => store.deleteCapture(c.id)} className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400 shrink-0" aria-label="Delete">✕</button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* ── 2-col: Revenue + Weekly Goals ── */}
              <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">

                {/* Revenue Pipeline */}
                <div className="lg:col-span-3 card p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="text-base font-bold text-gray-800">💰 Revenue Pipeline</h2>
                    <button onClick={() => setRevenueTarget(!revenueTarget)}
                      title="Configure revenue settings"
                      aria-label="Revenue settings"
                      className="text-gray-400 hover:text-brand-red transition-colors p-1 rounded hover:bg-gray-100">
                      <span className="text-sm">⚙</span>
                    </button>
                  </div>

                  {revenueTarget && (
                    <div className="flex gap-2 mb-3 flex-wrap">
                      <div><label className="label">Target</label>
                        <input className="input w-28" type="number" placeholder="3000"
                          value={store.revenueSettings.monthlyTarget}
                          onChange={e => store.setRevenueSettings({ monthlyTarget: parseInt(e.target.value) || 0 })} /></div>
                      <div><label className="label">Currency</label>
                        <input className="input w-20" placeholder="USD"
                          value={store.revenueSettings.currency}
                          onChange={e => store.setRevenueSettings({ currency: e.target.value })} /></div>
                      <div><label className="label">Stale after</label>
                        <input className="input w-24" type="number" placeholder="3 days"
                          value={store.revenueSettings.staleAlertDays}
                          onChange={e => store.setRevenueSettings({ staleAlertDays: parseInt(e.target.value) || 3 })} /></div>
                    </div>
                  )}

                  {/* KPI row */}
                  <div className="grid grid-cols-3 gap-2 mb-4">
                    <div className="bg-green-50 rounded-xl p-2.5 text-center">
                      <p className="text-xs text-gray-500">Paid</p>
                      <p className="font-bold text-green-700">${paidThisMonth.toLocaleString()}</p>
                    </div>
                    <div className="bg-blue-50 rounded-xl p-2.5 text-center">
                      <p className="text-xs text-gray-500">Pipeline</p>
                      <p className="font-bold text-blue-700">${openPipeline.toLocaleString()}</p>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-2.5 text-center">
                      <p className="text-xs text-gray-500">Target</p>
                      <p className="font-bold text-gray-700">${store.revenueSettings.monthlyTarget.toLocaleString()}</p>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="mb-4">
                    <div className="flex justify-between text-xs text-gray-500 mb-1">
                      <span>{pct}% of monthly target</span>
                      <span className={pct >= 100 ? "text-green-600 font-bold" : "text-gray-400"}>{pct >= 100 ? "🎉 Target hit!" : `${store.revenueSettings.monthlyTarget - paidThisMonth > 0 ? "$" + (store.revenueSettings.monthlyTarget - paidThisMonth).toLocaleString() : ""} to go`}</span>
                    </div>
                    <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className={clsx("h-full rounded-full transition-all", pct >= 100 ? "bg-green-500" : "bg-brand-gold")} style={{ width: `${pct}%` }} />
                    </div>
                  </div>

                  {/* Stale alerts */}
                  {staleDeals.length > 0 && (
                    <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-3">
                      <p className="text-red-700 text-xs font-semibold">⚠️ {staleDeals.length} deal{staleDeals.length > 1 ? "s" : ""} stale — {store.revenueSettings.staleAlertDays}+ days no update</p>
                      {staleDeals.filter(d => d.client?.trim()).length > 0 && (
                        <p className="text-red-600 text-xs mt-0.5">{staleDeals.filter(d => d.client?.trim()).map(d => d.client).join(", ")}</p>
                      )}
                    </div>
                  )}

                  {/* Deals by stream */}
                  {(["sourcing", "itinerary", "markets"] as DealStream[]).map(stream => {
                    const streamDeals = store.deals.filter(d => d.stream === stream)
                    return (
                      <div key={stream} className="mb-3">
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                          {stream === "sourcing" ? "🔗 Sourcing" : stream === "itinerary" ? "🗺 Itinerary" : "🏪 Market Guides"}
                          <span className="ml-2 text-gray-300 normal-case font-normal">({streamDeals.length})</span>
                        </p>
                        {streamDeals.length === 0 && <p className="text-xs text-gray-300 italic pl-1">No deals</p>}
                        {streamDeals.map(deal => {
                          const stale = (Date.now() - new Date(deal.updatedAt).getTime()) / 86400000 >= store.revenueSettings.staleAlertDays
                          return (
                            <div key={deal.id} className={clsx("flex items-center gap-2 p-2 rounded-lg mb-1 group", stale && deal.status !== "paid" ? "bg-red-50" : "hover:bg-gray-50")}>
                              <select value={deal.status}
                                onChange={e => store.setDealStatus(deal.id, e.target.value as DealStatus)}
                                className={clsx("text-xs px-2 py-0.5 rounded-full border-0 font-medium cursor-pointer", DEAL_STATUS_LABELS[deal.status]?.color)}>
                                {Object.entries(DEAL_STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v.en}</option>)}
                              </select>
                              <span className="flex-1 text-sm font-medium truncate">{deal.client}</span>
                              <span className="text-sm font-bold text-gray-700">${Number(deal.value || 0).toLocaleString()}</span>
                              <button onClick={() => setDealLogId(dealLogId === deal.id ? null : deal.id)}
                                aria-label="Deal log" className="text-gray-300 hover:text-brand-gold text-xs">📝</button>
                              <button onClick={() => store.deleteDeal(deal.id)}
                                aria-label="Delete deal" className="opacity-0 group-hover:opacity-100 text-gray-200 hover:text-red-400 text-xs">✕</button>
                            </div>
                          )
                        })}
                        {dealLogId && streamDeals.find(d => d.id === dealLogId) && (
                          <div className="bg-brand-cream rounded-lg p-3 mb-2">
                            <p className="text-xs font-semibold text-gray-600 mb-2">📝 {streamDeals.find(d => d.id === dealLogId)?.client}</p>
                            {streamDeals.find(d => d.id === dealLogId)?.logs.map(log => (
                              <p key={log.id} className="text-xs text-gray-500 mb-1">· {new Date(log.date).toLocaleDateString()} — {log.note}</p>
                            ))}
                            <div className="flex gap-2 mt-2">
                              <input className="input flex-1 text-xs" placeholder="Add note..." value={dealLogNote}
                                onChange={e => setDealLogNote(e.target.value)}
                                onKeyDown={e => { if (e.key === "Enter" && dealLogNote.trim()) { store.addDealLog(dealLogId!, dealLogNote); setDealLogNote("") } }} />
                              <button onClick={() => { if (dealLogNote.trim()) { store.addDealLog(dealLogId!, dealLogNote); setDealLogNote("") } }}
                                className="btn-secondary px-2 py-1">＋</button>
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}

                  {showDealForm ? (
                    <div className="border border-gray-200 rounded-lg p-3 mt-2 bg-gray-50">
                      <div className="grid grid-cols-2 gap-2 mb-2">
                        <input className="input" placeholder="Client name" value={newDeal.client} onChange={e => setNewDeal(d => ({ ...d, client: e.target.value }))} />
                        <select className="input" value={newDeal.stream} onChange={e => setNewDeal(d => ({ ...d, stream: e.target.value as DealStream }))}>
                          <option value="sourcing">Sourcing</option>
                          <option value="itinerary">Itinerary</option>
                          <option value="markets">Market Guide</option>
                        </select>
                        <input className="input" type="number" placeholder="Value ($)" value={newDeal.value || ""} onChange={e => setNewDeal(d => ({ ...d, value: parseFloat(e.target.value) || 0 }))} />
                        <input className="input" placeholder="Next action" value={newDeal.nextAction} onChange={e => setNewDeal(d => ({ ...d, nextAction: e.target.value }))} />
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => { if (newDeal.client) { store.addDeal(newDeal); setNewDeal({ client: "", stream: "sourcing", status: "lead" as DealStatus, value: 0, currency: "USD", nextAction: "" }); setShowDealForm(false) } }}
                          className="btn-primary text-xs">Add Deal</button>
                        <button onClick={() => setShowDealForm(false)} className="btn-secondary text-xs">Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <button onClick={() => setShowDealForm(true)} className="btn-secondary w-full justify-center mt-2 text-xs">＋ Add Deal</button>
                  )}
                </div>

                {/* Weekly Goals */}
                <div className="lg:col-span-2 card p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="text-base font-bold text-gray-800">🎯 Weekly Goals</h2>
                    {weekGoals.length > 0 && (
                      <span className="text-xs font-semibold text-gray-500">
                        {weekGoals.filter(g => g.progress === 100).length}/{weekGoals.length} done
                      </span>
                    )}
                  </div>
                  <div className="space-y-3 mb-3">
                    {weekGoals.length === 0 && <p className="text-xs text-gray-300 italic">No goals this week yet</p>}
                    {weekGoals.map(g => (
                      <div key={g.id} className="group">
                        <div className="flex items-center justify-between mb-1">
                          <p className={clsx("text-sm flex-1", g.progress === 100 ? "line-through text-gray-400" : "text-gray-700")}>{g.text}</p>
                          <div className="flex items-center gap-1 ml-2">
                            <span className="text-xs text-gray-400">{g.progress}%</span>
                            <button onClick={() => store.deleteWeeklyGoal(g.id)}
                              className="opacity-0 group-hover:opacity-100 text-gray-200 hover:text-red-400 text-xs">✕</button>
                          </div>
                        </div>
                        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div className={clsx("h-full rounded-full transition-all", g.progress === 100 ? "bg-green-500" : "bg-brand-gold")}
                            style={{ width: `${g.progress}%` }} />
                        </div>
                        <input type="range" min={0} max={100} value={g.progress}
                          onChange={e => store.updateGoalProgress(g.id, parseInt(e.target.value))}
                          className="w-full h-1 accent-brand-gold opacity-0 group-hover:opacity-100 mt-1 transition-opacity cursor-pointer" />
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input className="input flex-1 text-xs" placeholder="Add goal for this week..." value={newGoal}
                      onChange={e => setNewGoal(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter" && newGoal.trim()) { store.addWeeklyGoal(newGoal.trim()); setNewGoal("") } }} />
                    <button onClick={() => { if (newGoal.trim()) { store.addWeeklyGoal(newGoal.trim()); setNewGoal("") } }}
                      className="btn-secondary px-2 py-1 text-xs">＋</button>
                  </div>
                </div>
              </div>

              {/* ── Projects (only if non-empty) ── */}
              {store.projects.length > 0 && (
                <div className="card p-4">
                  <h2 className="text-base font-bold text-gray-800 mb-3">🚀 Active Projects</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {store.projects.map(p => (
                      <div key={p.id} className="flex items-center gap-3 p-2.5 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors group">
                        <div className={clsx("w-2.5 h-2.5 rounded-full shrink-0",
                          p.health === "on-track" ? "bg-green-400" : p.health === "at-risk" ? "bg-yellow-400" : "bg-red-400")} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold truncate text-gray-800">{p.name}</p>
                          <p className="text-xs text-gray-400 truncate">→ {p.nextAction}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="w-12 h-1.5 bg-gray-200 rounded-full overflow-hidden mb-0.5">
                            <div className="h-full bg-brand-gold rounded-full" style={{ width: `${p.progress}%` }} />
                          </div>
                          <p className="text-xs text-gray-400">{p.progress}%</p>
                        </div>
                        {p.liveUrl && <a href={p.liveUrl} target="_blank" rel="noopener" className="text-brand-red text-xs hover:underline shrink-0" aria-label="Open live URL">↗</a>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── Social Snapshot (promoted, not buried) ── */}
              <SocialSection />

            </div>
          )}

          {/* ── FOOTAGE VAULT TAB ─────────────────── */}
          {tab === "vault" && <FootageVault />}

          {/* ── INSTAGRAM TAB ─────────────────────── */}
          {tab === "instagram" && <InstagramSuite />}

          {/* ── CALENDAR TAB ──────────────────────── */}
          {tab === "calendar" && <ContentCalendar />}

          {/* ── CONTACTS TAB ──────────────────────── */}
          {tab === "contacts" && <ContactsCRM />}

          {/* ── FINANCE TAB ───────────────────────── */}
          {tab === "finance" && <FinanceHub />}

          {/* ── JOURNAL TAB ───────────────────────── */}
          {tab === "journal" && <Journal />}

          {/* ── PROJECTS TAB ──────────────────────── */}
          {tab === "projects" && <ProjectsHub />}

          {/* ── LINKS TAB ─────────────────────────── */}
          {tab === "links" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h1 className="text-xl font-bold">🔗 Trip.com Affiliate Links</h1>
                <button onClick={() => setShowLinkForm(!showLinkForm)} className="btn-primary">＋ Add Link</button>
              </div>

              {showLinkForm && (
                <div className="card p-4">
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div><label className="label">Title</label><input className="input" placeholder="e.g. Beijing Marriott" value={newLink.title} onChange={e => setNewLink(l => ({ ...l, title: e.target.value }))} /></div>
                    <div><label className="label">Category</label>
                      <select className="input" value={newLink.category} onChange={e => setNewLink(l => ({ ...l, category: e.target.value as AffiliateCat }))}>
                        <option value="hotel">🏨 Hotel</option>
                        <option value="flight">✈️ Flight</option>
                        <option value="train">🚄 Train</option>
                        <option value="attraction">🏛 Attraction</option>
                        <option value="other">📦 Other</option>
                      </select>
                    </div>
                    <div className="col-span-2"><label className="label">URL</label><input className="input" placeholder="https://trip.com/..." value={newLink.url} onChange={e => setNewLink(l => ({ ...l, url: e.target.value }))} /></div>
                    <div><label className="label">Commission (optional)</label><input className="input" placeholder="e.g. 6%" value={newLink.commission} onChange={e => setNewLink(l => ({ ...l, commission: e.target.value }))} /></div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => { if (newLink.title && newLink.url) { store.addAffiliateLink(newLink); setNewLink({ title: "", url: "", category: "hotel", commission: "" }); setShowLinkForm(false) } }} className="btn-primary">Save</button>
                    <button onClick={() => setShowLinkForm(false)} className="btn-secondary">Cancel</button>
                  </div>
                </div>
              )}

              {/* Links grouped by category */}
              {(["hotel", "flight", "train", "attraction", "other"] as AffiliateCat[]).map(cat => {
                const links = store.affiliateLinks.filter(l => l.category === cat)
                if (!links.length) return null
                const icons: Record<string, string> = { hotel: "🏨", flight: "✈️", train: "🚄", attraction: "🏛", other: "📦" }
                return (
                  <div key={cat}>
                    <p className="section-title">{icons[cat]} {cat.charAt(0).toUpperCase() + cat.slice(1)}</p>
                    <div className="space-y-2">
                      {links.map(link => (
                        <div key={link.id} className="card p-3 flex items-center gap-3 group">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium">{link.title}</p>
                            <p className="text-xs text-gray-400 truncate">{link.url}</p>
                            {link.commission && <p className="text-xs text-brand-gold font-medium">{link.commission} commission</p>}
                          </div>
                          <button onClick={() => { navigator.clipboard.writeText(link.url) }}
                            className="btn-secondary text-xs py-1">Copy</button>
                          <a href={link.url} target="_blank" rel="noopener" className="text-brand-red text-sm hover:text-brand-red-dark">↗</a>
                          <button onClick={() => store.deleteAffiliateLink(link.id)}
                            className="opacity-0 group-hover:opacity-100 text-gray-200 hover:text-red-400 text-xs">✕</button>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}

              {store.affiliateLinks.length === 0 && !showLinkForm && (
                <div className="card p-12 text-center text-gray-400">
                  <p className="text-4xl mb-3">🔗</p>
                  <p className="font-medium">No affiliate links yet</p>
                  <p className="text-sm mt-1">Add your Trip.com links for quick copying</p>
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      {/* Mobile bottom nav */}
      <nav className="mobile-nav flex">
        {NAV.filter(n => MOBILE_NAV.includes(n.id)).map(n => (
          <button key={n.id} onClick={() => setTab(n.id)}
            className={clsx("flex-1 flex flex-col items-center py-3 text-xs transition-colors",
              tab === n.id ? "text-brand-red" : "text-gray-400"
            )}>
            <span className="text-xl mb-0.5">{n.icon}</span>
            {n.label}
          </button>
        ))}
      </nav>

      {/* Floating quick capture (mobile) */}
      <button
        onClick={() => { const t = prompt("Quick capture:"); if (t?.trim()) store.addCapture(t.trim()) }}
        className="fixed bottom-20 right-4 lg:bottom-6 lg:right-6 w-12 h-12 bg-brand-gold text-white rounded-full shadow-lg flex items-center justify-center text-2xl z-50 hover:bg-brand-gold-light transition-colors">
        ＋
      </button>
    </div>
  )
}
