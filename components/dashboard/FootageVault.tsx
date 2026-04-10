"use client"
import { useState, useRef } from "react"
import { useStore } from "@/lib/store"
import { db } from "@/lib/db"
import clsx from "clsx"
import type { FootageTag, FootageStatus } from "@/types"

const TAG_CONFIG: Record<FootageTag, { label: string; emoji: string; color: string }> = {
  "city-tour":     { label: "جولة مدينة",    emoji: "🏙",  color: "bg-blue-100 text-blue-700" },
  "food-halal":    { label: "أكل حلال",      emoji: "🍜",  color: "bg-green-100 text-green-700" },
  "market":        { label: "سوق / تسوق",    emoji: "🛍",  color: "bg-orange-100 text-orange-700" },
  "behind-scenes": { label: "كواليس",        emoji: "🎬",  color: "bg-purple-100 text-purple-700" },
  "product":       { label: "منتج / ماركة",  emoji: "📦",  color: "bg-yellow-100 text-yellow-700" },
  "nature":        { label: "طبيعة / جبال",  emoji: "⛰️",  color: "bg-teal-100 text-teal-700" },
  "people":        { label: "ناس / تفاعل",   emoji: "👥",  color: "bg-pink-100 text-pink-700" },
  "transport":     { label: "مواصلات",       emoji: "🚄",  color: "bg-indigo-100 text-indigo-700" },
  "other":         { label: "أخرى",          emoji: "📱",  color: "bg-gray-100 text-gray-600" },
}

const STATUS_CONFIG: Record<FootageStatus, { label: string; color: string; dot: string }> = {
  "unused":   { label: "لم يُستخدم", color: "bg-red-100 text-red-700",    dot: "bg-red-400" },
  "scripted": { label: "عنده سكريبت", color: "bg-yellow-100 text-yellow-700", dot: "bg-yellow-400" },
  "posted":   { label: "نُشر",       color: "bg-green-100 text-green-700", dot: "bg-green-400" },
}

const EMPTY_FORM = {
  title: "", location: "", tag: "city-tour" as FootageTag,
  duration: "", notes: "", filmDate: new Date().toISOString().split("T")[0],
  thumbnail: "", status: "unused" as FootageStatus,
}

export default function FootageVault() {
  const { footage, addFootage, updateFootage, deleteFootage, contentIdeas } = useStore()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ ...EMPTY_FORM })
  const [thumbFile, setThumbFile] = useState<File | null>(null)
  const [filterStatus, setFilterStatus] = useState<FootageStatus | "all">("all")
  const [filterTag, setFilterTag] = useState<FootageTag | "all">("all")
  const [scriptLoading, setScriptLoading] = useState<string | null>(null)
  const [scriptResult, setScriptResult] = useState<{ id: string; script: any } | null>(null)
  const [saving, setSaving] = useState(false)
  const thumbRef = useRef<HTMLInputElement>(null)

  const filtered = footage.filter(f => {
    if (filterStatus !== "all" && f.status !== filterStatus) return false
    if (filterTag !== "all" && f.tag !== filterTag) return false
    return true
  })

  const unusedCount = footage.filter(f => f.status === "unused").length

  function handleThumb(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setThumbFile(file)
    // preview only
    const reader = new FileReader()
    reader.onload = ev => setForm(f => ({ ...f, thumbnail: ev.target?.result as string }))
    reader.readAsDataURL(file)
  }

  async function handleAdd() {
    if (!form.title.trim()) return
    setSaving(true)
    try {
      let thumbnailUrl: string | undefined
      const tempId = crypto.randomUUID()
      if (thumbFile) {
        try {
          thumbnailUrl = await db.footage.uploadThumbnail(thumbFile, tempId)
        } catch {
          // fall back to base64 if Storage upload fails
          thumbnailUrl = form.thumbnail
        }
      }
      addFootage({
        title: form.title,
        location: form.location,
        tag: form.tag,
        status: form.status,
        duration: form.duration,
        notes: form.notes,
        filmDate: form.filmDate,
        thumbnail: thumbnailUrl,
      })
      setForm({ ...EMPTY_FORM })
      setThumbFile(null)
      setShowForm(false)
    } finally {
      setSaving(false)
    }
  }

  async function generateScriptForClip(clip: { id: string; title: string; location: string; tag: string; notes?: string }) {
    setScriptLoading(clip.id)
    setScriptResult(null)
    try {
      const topic = `${clip.title}${clip.location ? ` في ${clip.location}` : ""}`
      const res = await fetch("/api/generate-script", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          series: clip.tag === "food-halal" ? "food-halal"
                : clip.tag === "market" ? "shopping"
                : clip.tag === "city-tour" ? "city-series"
                : clip.tag === "product" ? "chinese-brands"
                : "behind-scenes",
          vibe: "storytelling",
          topic,
          language: "ar",
          tone: "jordanian",
          duration: 60,
          enrichment: null,
        })
      })
      const data = await res.json()
      setScriptResult({ id: clip.id, script: data })
      updateFootage(clip.id, { status: "scripted" })
    } catch {}
    setScriptLoading(null)
  }

  const daysSinceFilmed = (filmDate?: string) => {
    if (!filmDate) return null
    return Math.floor((Date.now() - new Date(filmDate).getTime()) / 86400000)
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-xl font-bold text-gray-900">🎬 Footage Vault</h2>
          <p className="text-sm text-gray-400 mt-0.5">
            {footage.length} كليب مسجّل
            {unusedCount > 0 && <span className="text-red-500 font-semibold"> · {unusedCount} لم يُستخدم بعد</span>}
          </p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="btn-primary">
          + سجّل كليب
        </button>
      </div>

      {/* Unused banner */}
      {unusedCount > 0 && !showForm && (
        <div className="bg-gradient-to-r from-brand-red to-brand-red-dark rounded-xl p-4 text-white flex items-center gap-3">
          <span className="text-3xl">🎥</span>
          <div className="flex-1">
            <p className="font-bold">عندك {unusedCount} كليب ما استخدمتهم بعد!</p>
            <p className="text-white/70 text-sm mt-0.5">اختار كليب وانتج منه ريلز الآن</p>
          </div>
          <button onClick={() => setFilterStatus("unused")}
            className="bg-white/20 hover:bg-white/30 text-white text-sm px-4 py-2 rounded-lg transition-colors shrink-0">
            عرضهم
          </button>
        </div>
      )}

      {/* Add form */}
      {showForm && (
        <div className="card p-4 border-l-4 border-brand-red">
          <h3 className="font-bold text-gray-900 mb-3">سجّل كليب جديد</h3>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div className="col-span-2">
              <label className="label">عنوان الكليب *</label>
              <input className="input" dir="auto"
                placeholder="مثال: جولة في سوق الملابس بقوانغتشو، شلال عنشي الصباح..."
                value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
            </div>
            <div>
              <label className="label">الموقع</label>
              <input className="input" dir="auto" placeholder="مثال: عنشي، هوبي"
                value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} />
            </div>
            <div>
              <label className="label">تاريخ التصوير</label>
              <input className="input" type="date" value={form.filmDate}
                onChange={e => setForm(f => ({ ...f, filmDate: e.target.value }))} />
            </div>
            <div>
              <label className="label">نوع المحتوى</label>
              <select className="input" value={form.tag}
                onChange={e => setForm(f => ({ ...f, tag: e.target.value as FootageTag }))}>
                {Object.entries(TAG_CONFIG).map(([k, v]) => (
                  <option key={k} value={k}>{v.emoji} {v.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">المدة</label>
              <input className="input" placeholder="مثال: 1:30 أو 45 ثانية"
                value={form.duration} onChange={e => setForm(f => ({ ...f, duration: e.target.value }))} />
            </div>
            <div className="col-span-2">
              <label className="label">ملاحظات (اختياري)</label>
              <input className="input" dir="auto"
                placeholder="أي تفاصيل تساعدك تتذكر الكليب..."
                value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
            </div>
            {/* Thumbnail upload */}
            <div className="col-span-2">
              <label className="label">سكرين شوت من الكليب (اختياري)</label>
              <div className="flex items-center gap-3">
                <input ref={thumbRef} type="file" accept="image/*" className="hidden" onChange={handleThumb} />
                <button onClick={() => thumbRef.current?.click()}
                  className="btn-secondary text-xs py-1.5">
                  📸 ارفع صورة
                </button>
                {form.thumbnail && (
                  <img src={form.thumbnail} alt="" className="w-16 h-10 object-cover rounded-lg" />
                )}
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={handleAdd} disabled={saving} className="btn-primary">
              {saving ? <><span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />جاري الحفظ...</> : "حفظ الكليب"}
            </button>
            <button onClick={() => { setShowForm(false); setForm({ ...EMPTY_FORM }); setThumbFile(null) }}
              className="btn-secondary">إلغاء</button>
          </div>
        </div>
      )}

      {/* Filters */}
      {footage.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          <div className="flex bg-gray-100 rounded-lg p-0.5 gap-0.5">
            {(["all", "unused", "scripted", "posted"] as const).map(s => (
              <button key={s} onClick={() => setFilterStatus(s)}
                className={clsx("px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
                  filterStatus === s ? "bg-white shadow text-gray-900" : "text-gray-500"
                )}>
                {s === "all" ? `الكل (${footage.length})`
                  : `${STATUS_CONFIG[s].label} (${footage.filter(f => f.status === s).length})`}
              </button>
            ))}
          </div>
          <select className="input w-auto text-xs"
            value={filterTag} onChange={e => setFilterTag(e.target.value as FootageTag | "all")}>
            <option value="all">كل الأنواع</option>
            {Object.entries(TAG_CONFIG).map(([k, v]) => (
              <option key={k} value={k}>{v.emoji} {v.label}</option>
            ))}
          </select>
        </div>
      )}

      {/* Empty state */}
      {footage.length === 0 && (
        <div className="card p-12 text-center text-gray-400">
          <p className="text-5xl mb-3">🎥</p>
          <p className="font-semibold text-gray-600">لا كليبات مسجّلة بعد</p>
          <p className="text-sm mt-1 max-w-xs mx-auto">
            في كل مرة تصوّر — سجّل الكليب هنا. 30 ثانية الآن تحميك من نسيانه لأشهر.
          </p>
          <button onClick={() => setShowForm(true)} className="btn-primary mt-4 mx-auto">
            + سجّل أول كليب
          </button>
        </div>
      )}

      {/* Clips grid */}
      <div className="space-y-2">
        {filtered.map(clip => {
          const tag = TAG_CONFIG[clip.tag]
          const status = STATUS_CONFIG[clip.status]
          const days = daysSinceFilmed(clip.filmDate)
          const isOld = days !== null && days > 14 && clip.status === "unused"
          const isGenerating = scriptLoading === clip.id
          const hasScript = scriptResult?.id === clip.id

          return (
            <div key={clip.id}
              className={clsx("card p-4 transition-all",
                isOld ? "border-l-4 border-red-300" : ""
              )}>
              <div className="flex gap-3">
                {/* Thumbnail or placeholder */}
                {clip.thumbnail ? (
                  <img src={clip.thumbnail} alt="" className="w-20 h-14 object-cover rounded-lg shrink-0" />
                ) : (
                  <div className={clsx("w-20 h-14 rounded-lg flex items-center justify-center text-2xl shrink-0", tag.color.split(" ")[0])}>
                    {tag.emoji}
                  </div>
                )}

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-900 truncate" dir="auto">{clip.title}</p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        {clip.location && (
                          <span className="text-xs text-gray-400">📍 {clip.location}</span>
                        )}
                        {clip.duration && (
                          <span className="text-xs text-gray-400">⏱ {clip.duration}</span>
                        )}
                        {days !== null && (
                          <span className={clsx("text-xs font-medium",
                            isOld ? "text-red-500" : "text-gray-400"
                          )}>
                            {days === 0 ? "اليوم" : `منذ ${days} يوم`}
                            {isOld && " ⚠️"}
                          </span>
                        )}
                      </div>
                      {clip.notes && (
                        <p className="text-xs text-gray-400 mt-1 line-clamp-1" dir="auto">{clip.notes}</p>
                      )}
                    </div>

                    {/* Status + delete */}
                    <div className="flex items-center gap-2 shrink-0">
                      <select value={clip.status}
                        onChange={e => updateFootage(clip.id, { status: e.target.value as FootageStatus })}
                        className={clsx("text-xs px-2 py-1 rounded-full border-0 cursor-pointer font-medium", status.color)}>
                        {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                          <option key={k} value={k}>{v.label}</option>
                        ))}
                      </select>
                      <button onClick={() => deleteFootage(clip.id)}
                        className="text-gray-200 hover:text-red-400 text-sm transition-colors">✕</button>
                    </div>
                  </div>

                  {/* Tags */}
                  <div className="flex items-center gap-2 mt-2">
                    <span className={clsx("text-xs px-2 py-0.5 rounded-full font-medium", tag.color)}>
                      {tag.emoji} {tag.label}
                    </span>

                    {/* Action buttons */}
                    {clip.status === "unused" && (
                      <button
                        onClick={() => generateScriptForClip(clip)}
                        disabled={isGenerating}
                        className="text-xs btn-primary py-1 px-3 ml-auto">
                        {isGenerating
                          ? <><span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />جاري...</>
                          : "✍️ اكتب سكريبت"}
                      </button>
                    )}
                    {clip.status === "scripted" && (
                      <span className="text-xs text-yellow-600 ml-auto font-medium">✍️ السكريبت جاهز</span>
                    )}
                    {clip.status === "posted" && (
                      <span className="text-xs text-green-600 ml-auto font-medium">✅ نُشر</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Script result inline */}
              {hasScript && scriptResult && (
                <div className="mt-3 border-t border-gray-100 pt-3 space-y-2">
                  <div className="bg-brand-red/5 border border-brand-red/15 rounded-lg px-3 py-2">
                    <p className="text-xs font-bold text-brand-red mb-1">⚡ الهوك</p>
                    <p className="text-sm font-medium" dir="auto">{scriptResult.script.hook}</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg px-3 py-2">
                    <p className="text-xs font-bold text-gray-500 mb-1">📝 الجسم</p>
                    <p className="text-sm text-gray-700 line-clamp-3" dir="auto">{scriptResult.script.body}</p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => {
                      navigator.clipboard.writeText(
                        `${scriptResult.script.hook}\n\n${scriptResult.script.body}\n\n${scriptResult.script.cta}`
                      )
                    }} className="btn-secondary text-xs py-1.5 flex-1 justify-center">
                      📋 نسخ السكريبت
                    </button>
                    <button onClick={() => setScriptResult(null)}
                      className="btn-ghost text-xs py-1.5">إخفاء</button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {filtered.length === 0 && footage.length > 0 && (
        <div className="card p-6 text-center text-gray-400">
          <p>لا كليبات بهذا الفلتر</p>
        </div>
      )}
    </div>
  )
}
