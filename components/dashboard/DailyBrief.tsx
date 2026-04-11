"use client"
import { useState, useEffect } from "react"
import { useStore } from "@/lib/store"
import clsx from "clsx"

const today = () => new Date().toISOString().split("T")[0]
const thisMonday = () => {
  const d = new Date()
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  return new Date(new Date().setDate(diff)).toISOString().split("T")[0]
}

interface BriefItem {
  id: string
  type: "footage" | "deal" | "streak" | "goal" | "capture" | "post"
  priority: "high" | "medium" | "low"
  emoji: string
  title: string
  subtitle: string
  action?: string
  onAction?: () => void
  link?: string   // tab to navigate to
}

interface Props {
  onNavigate?: (tab: string) => void
}

export default function DailyBrief({ onNavigate }: Props) {
  const store = useStore()
  const [loading, setLoading] = useState(false)
  const [aiSummary, setAiSummary] = useState("")
  const [dismissed, setDismissed] = useState<string[]>([])
  const [weather, setWeather] = useState<{ temp: string | number; emoji: string } | null>(null)

  useEffect(() => {
    fetch("/api/weather").then(r => r.json()).then(d => setWeather(d)).catch(() => {})
  }, [])

  // Build actionable items from real data
  const items: BriefItem[] = []

  // 1. Unused footage — most important
  const unusedFootage = store.footage.filter(f => f.status === "unused")
  const oldFootage = unusedFootage.filter(f => {
    if (!f.filmDate) return false
    return Math.floor((Date.now() - new Date(f.filmDate).getTime()) / 86400000) > 7
  })

  if (oldFootage.length > 0) {
    items.push({
      id: "old-footage",
      type: "footage",
      priority: "high",
      emoji: "🎥",
      title: `${oldFootage.length} كليب قديم لم يُستخدم`,
      subtitle: oldFootage.slice(0, 2).map(f => f.title?.trim()).filter(Boolean).join("، ") + (oldFootage.length > 2 ? "..." : ""),
      action: "اعمل سكريبت",
      link: "vault",
    })
  } else if (unusedFootage.length > 0) {
    items.push({
      id: "unused-footage",
      type: "footage",
      priority: "medium",
      emoji: "🎬",
      title: `${unusedFootage.length} كليب جاهز للإنتاج`,
      subtitle: unusedFootage.slice(0, 2).map(f => f.title?.trim()).filter(Boolean).join("، "),
      action: "عرض الكليبات",
      link: "vault",
    })
  }

  // 2. Post streak risk
  const lastPosted = store.streaks.lastPostedDate
  const todayStr = today()
  const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0]
  const daysSincePost = lastPosted
    ? Math.floor((Date.now() - new Date(lastPosted).getTime()) / 86400000)
    : 999
  if (daysSincePost >= 2) {
    items.push({
      id: "streak-risk",
      type: "streak",
      priority: daysSincePost >= 3 ? "high" : "medium",
      emoji: daysSincePost >= 3 ? "🔥💀" : "⚠️",
      title: daysSincePost >= 3
        ? `${daysSincePost} أيام بدون نشر — الستريك في خطر!`
        : "ما نشرت امبارح — انتبه للستريك",
      subtitle: `آخر نشر: ${lastPosted ? new Date(lastPosted).toLocaleDateString("ar-EG", { weekday: "long", day: "numeric", month: "short" }) : "لم يُسجَّل"}`,
      action: unusedFootage.length > 0 ? "عندك كليبات جاهزة" : "اكتب سكريبت",
      link: unusedFootage.length > 0 ? "vault" : "instagram",
    })
  }

  // 3. Stale deals
  const staleDeals = store.deals.filter(d => {
    if (d.status === "paid") return false
    const days = (Date.now() - new Date(d.updatedAt).getTime()) / 86400000
    return days >= store.revenueSettings.staleAlertDays
  })
  if (staleDeals.length > 0) {
    const staleNames = staleDeals.map(d => d.client?.trim()).filter(Boolean).join("، ")
    items.push({
      id: "stale-deals",
      type: "deal",
      priority: "high",
      emoji: "💰",
      title: `${staleDeals.length} صفقة تحتاج متابعة`,
      subtitle: staleNames || `${staleDeals.length} deals`,
      action: "تابع الصفقات",
      link: "home",
    })
  }

  // 4. Unprocessed captures
  const pendingCaptures = store.captures.filter(c => !c.processed)
  if (pendingCaptures.length >= 3) {
    items.push({
      id: "captures",
      type: "capture",
      priority: "low",
      emoji: "💡",
      title: `${pendingCaptures.length} أفكار تنتظر معالجة`,
      subtitle: pendingCaptures.slice(0, 2).map(c => c.text).join("، "),
      action: "راجعها",
      link: "home",
    })
  }

  // 5. Weekly goals with no progress
  const weekGoals = store.weeklyGoals.filter(g => g.weekStart === thisMonday())
  const zeroGoals = weekGoals.filter(g => g.progress === 0)
  if (zeroGoals.length > 0) {
    items.push({
      id: "zero-goals",
      type: "goal",
      priority: "low",
      emoji: "🎯",
      title: `${zeroGoals.length} هدف أسبوعي بدون تقدم`,
      subtitle: zeroGoals.slice(0, 2).map(g => g.text).join("، "),
      action: "حدّث التقدم",
      link: "home",
    })
  }

  // Content plan for this week based on footage
  const weeklyPlan = unusedFootage.slice(0, 3)

  const visibleItems = items.filter(i => !dismissed.includes(i.id))
  const highPriority = visibleItems.filter(i => i.priority === "high")
  const rest = visibleItems.filter(i => i.priority !== "high")

  const PRIORITY_COLOR = {
    high:   "border-l-4 border-red-400 bg-red-50",
    medium: "border-l-4 border-yellow-400 bg-yellow-50",
    low:    "border-l-4 border-blue-200 bg-blue-50",
  }

  async function getAISummary() {
    setLoading(true)
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
          unusedFootage: unusedFootage.map(f => ({ title: f.title, location: f.location, days: Math.floor((Date.now() - new Date(f.filmDate || f.createdAt).getTime()) / 86400000) })),
        })
      })
      const data = await res.json()
      setAiSummary(data.brief || "")
    } catch {}
    setLoading(false)
  }

  const greetingHour = new Date().getHours()
  const greeting = greetingHour < 12 ? "صباح الخير" : greetingHour < 17 ? "مساء النور" : "مساء الخير"

  return (
    <div className="space-y-3">
      {/* Top greeting bar */}
      <div className="rounded-2xl p-5 text-white overflow-hidden relative"
        style={{ background: "linear-gradient(135deg, #8B1515 0%, #A51C1C 60%, #7D1515 100%)" }}>
        {/* Background pattern */}
        <div className="absolute inset-0 opacity-5"
          style={{ backgroundImage: "radial-gradient(circle at 20% 50%, white 1px, transparent 1px), radial-gradient(circle at 80% 20%, white 1px, transparent 1px)", backgroundSize: "40px 40px" }} />

        <div className="relative flex items-start justify-between">
          <div>
            <p className="text-white/60 text-sm">
              {new Date().toLocaleDateString("ar-EG", { weekday: "long", day: "numeric", month: "long" })}
              {weather && <span> · {weather.emoji} {weather.temp}°C</span>}
            </p>
            <h1 className="text-2xl font-black mt-1 tracking-tight">{greeting} يا هشام 👋</h1>
            <div className="flex items-center gap-3 mt-2 flex-wrap">
              <span className="flex items-center gap-1 text-sm bg-white/10 px-2.5 py-1 rounded-full">
                🔥 <span className="font-bold">{store.streaks.checkinStreak}</span> <span className="text-white/60">يوم</span>
              </span>
              <span className="flex items-center gap-1 text-sm bg-white/10 px-2.5 py-1 rounded-full">
                📸 <span className="font-bold">{store.streaks.postingStreak}</span> <span className="text-white/60">ستريك</span>
              </span>
              {unusedFootage.length > 0 && (
                <span className="flex items-center gap-1 text-sm bg-brand-gold/30 px-2.5 py-1 rounded-full font-bold text-brand-gold">
                  🎥 {unusedFootage.length} كليب
                </span>
              )}
            </div>
          </div>
          <div className="flex flex-col gap-2 shrink-0">
            <button onClick={getAISummary} disabled={loading}
              className="bg-white/15 hover:bg-white/25 text-white text-xs px-3 py-2 rounded-xl transition-all font-medium border border-white/20">
              {loading
                ? <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin inline-block" />
                : "✨ بريف AI"}
            </button>
            {onNavigate && (
              <button onClick={() => onNavigate("ai")}
                className="bg-white text-brand-red text-xs px-3 py-2 rounded-xl transition-all font-bold shadow-sm hover:shadow-md">
                🤖 تكلم AI
              </button>
            )}
          </div>
        </div>
        {aiSummary && (
          <p className="text-white/90 text-sm mt-3 border-t border-white/20 pt-3 leading-relaxed">{aiSummary}</p>
        )}
      </div>

      {/* Action items */}
      {visibleItems.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">⚡ مطلوب منك اليوم</p>
          {[...highPriority, ...rest].map(item => (
            <div key={item.id}
              className={clsx("rounded-xl p-3 flex items-center gap-3", PRIORITY_COLOR[item.priority])}>
              <span className="text-2xl shrink-0">{item.emoji}</span>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900 text-sm">{item.title}</p>
                <p className="text-xs text-gray-500 truncate mt-0.5" dir="auto">{item.subtitle}</p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {item.action && item.link && (
                  <button onClick={() => onNavigate?.(item.link!)}
                    className="text-xs bg-white border border-gray-200 text-gray-700 px-2.5 py-1.5 rounded-lg hover:bg-gray-50 transition-colors font-medium">
                    {item.action}
                  </button>
                )}
                <button onClick={() => setDismissed(d => [...d, item.id])}
                  className="text-gray-300 hover:text-gray-500 text-sm px-1">✕</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* This week's content plan from footage */}
      {weeklyPlan.length > 0 && (
        <div className="card p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">📅 خطة المحتوى هذا الأسبوع</p>
            <button onClick={() => onNavigate?.("vault")}
              className="text-xs text-brand-red hover:underline">عرض الكل</button>
          </div>
          <div className="space-y-2">
            {weeklyPlan.map((clip, i) => (
              <div key={clip.id} className="flex items-center gap-3 p-2 bg-gray-50 rounded-xl">
                <span className="w-6 h-6 bg-brand-red text-white rounded-full flex items-center justify-center text-xs font-bold shrink-0">
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate" dir="auto">{clip.title}</p>
                  {clip.location && <p className="text-xs text-gray-400">📍 {clip.location}</p>}
                </div>
                <button onClick={() => onNavigate?.("vault")}
                  className="text-xs text-brand-red font-medium shrink-0">سكريبت ←</button>
              </div>
            ))}
            {unusedFootage.length > 3 && (
              <p className="text-xs text-gray-400 text-center">
                + {unusedFootage.length - 3} كليبات أخرى في الـ vault
              </p>
            )}
          </div>
        </div>
      )}

      {/* All good state */}
      {visibleItems.length === 0 && weeklyPlan.length === 0 && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-3">
          <span className="text-2xl">✅</span>
          <div>
            <p className="font-semibold text-green-800">كل شي تمام اليوم!</p>
            <p className="text-xs text-green-600 mt-0.5">ما في صفقات متأخرة أو كليبات ناسية. استمر!</p>
          </div>
        </div>
      )}
    </div>
  )
}
