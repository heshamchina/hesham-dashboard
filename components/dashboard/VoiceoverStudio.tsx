"use client"
import { useState, useRef, useCallback } from "react"
import { useStore } from "@/lib/store"
import clsx from "clsx"

const TONE_OPTIONS = [
  { id: "jordanian", label: "🇯🇴 أردنية",          lang: "ar" },
  { id: "msa",       label: "📖 فصحى",             lang: "ar" },
  { id: "mixed",     label: "🇯🇴📖 أردنية + فصحى", lang: "ar" },
  { id: "english",   label: "🇬🇧 English",          lang: "en" },
]

const STYLE_OPTIONS = [
  { id: "voiceover",  label: "🎙 Voiceover",   desc: "يصف ما يُرى ويضيف معلومات" },
  { id: "commentary", label: "📣 Commentary",  desc: "تعليق حماسي مباشر" },
  { id: "storytime",  label: "📖 Storytime",   desc: "حكي قصة بأسلوب سردي" },
]

export default function VoiceoverStudio() {
  const store = useStore()
  const fileRef = useRef<HTMLInputElement>(null)
  const dropRef = useRef<HTMLDivElement>(null)

  const [images, setImages] = useState<{ url: string; name: string; size: string }[]>([])
  const [context, setContext] = useState("")
  const [tone, setTone] = useState("jordanian")
  const [language, setLanguage] = useState("ar")
  const [duration, setDuration] = useState(60)
  const [style, setStyle] = useState("voiceover")
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)

  function copyText(text: string, key: string) {
    navigator.clipboard.writeText(text)
    setCopiedKey(key)
    setTimeout(() => setCopiedKey(null), 2000)
  }

  function formatSize(bytes: number) {
    return bytes > 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)}MB` : `${Math.round(bytes / 1024)}KB`
  }

  async function processFiles(files: FileList | File[]) {
    const arr = Array.from(files).filter(f => f.type.startsWith("image/")).slice(0, 6)
    const processed = await Promise.all(arr.map(file => new Promise<{ url: string; name: string; size: string }>((resolve) => {
      const reader = new FileReader()
      reader.onload = (e) => resolve({
        url: e.target?.result as string,
        name: file.name,
        size: formatSize(file.size),
      })
      reader.readAsDataURL(file)
    })))
    setImages(prev => [...prev, ...processed].slice(0, 6))
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    processFiles(e.dataTransfer.files)
  }, [])

  async function generate() {
    if (!images.length) return
    setLoading(true)
    setResult(null)
    try {
      const res = await fetch("/api/voiceover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          images: images.map(i => i.url),
          context,
          tone,
          language,
          duration,
          style,
        })
      })
      const data = await res.json()
      setResult(data)
    } catch {}
    setLoading(false)
  }

  function saveToIdea() {
    if (!result) return
    store.addIdea({
      series: "other",
      vibe: "storytelling",
      status: "scripted",
      hook: result.hook || "",
      script: result.fullScript || "",
      notes: result.filmingNote || "",
    })
    alert("✅ تم الحفظ في البايبلاين!")
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-gray-900">🎙 Voiceover Studio</h2>
        <p className="text-sm text-gray-400 mt-0.5">ارفع صور أو سكرين شوتس من الفيديو — AI يكتب التعليق الصوتي المناسب</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Left: upload + settings */}
        <div className="lg:col-span-2 space-y-3">

          {/* Drop zone */}
          <div
            ref={dropRef}
            onDragOver={e => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileRef.current?.click()}
            className={clsx(
              "rounded-xl border-2 border-dashed cursor-pointer transition-all p-6 text-center",
              dragging ? "border-brand-red bg-brand-red/5 scale-[1.01]" : "border-gray-200 hover:border-brand-red hover:bg-gray-50"
            )}>
            <input ref={fileRef} type="file" accept="image/*" multiple className="hidden"
              onChange={e => e.target.files && processFiles(e.target.files)} />
            <p className="text-3xl mb-2">📸</p>
            <p className="text-sm font-semibold text-gray-700">اسحب صور الفيديو هنا</p>
            <p className="text-xs text-gray-400 mt-1">أو اضغط للاختيار — حتى 6 صور</p>
            <p className="text-xs text-gray-300 mt-0.5">PNG, JPG, WEBP</p>
          </div>

          {/* Image previews */}
          {images.length > 0 && (
            <div className="grid grid-cols-3 gap-2">
              {images.map((img, i) => (
                <div key={i} className="relative group rounded-lg overflow-hidden aspect-video bg-gray-100">
                  <img src={img.url} alt={`frame-${i+1}`} className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all flex items-center justify-center">
                    <button
                      onClick={e => { e.stopPropagation(); setImages(prev => prev.filter((_, j) => j !== i)) }}
                      className="opacity-0 group-hover:opacity-100 bg-red-500 text-white rounded-full w-6 h-6 text-xs flex items-center justify-center transition-opacity">
                      ✕
                    </button>
                  </div>
                  <span className="absolute top-1 left-1 bg-black/50 text-white text-xs px-1 rounded">{i+1}</span>
                </div>
              ))}
              {images.length < 6 && (
                <button onClick={() => fileRef.current?.click()}
                  className="aspect-video rounded-lg border-2 border-dashed border-gray-200 hover:border-brand-red flex items-center justify-center text-gray-300 hover:text-brand-red transition-colors text-2xl">
                  +
                </button>
              )}
            </div>
          )}

          {/* Context */}
          <div>
            <label className="label">سياق إضافي (اختياري)</label>
            <textarea className="input resize-none text-sm" rows={2} dir="auto"
              placeholder="مثال: هذا سوق الملابس في قوانغتشو، الأسعار بالجملة..."
              value={context} onChange={e => setContext(e.target.value)} />
          </div>

          {/* Settings */}
          <div className="card p-3 space-y-3">
            {/* Language toggle */}
            <div>
              <label className="label">اللغة واللهجة</label>
              <div className="grid grid-cols-2 gap-1">
                {TONE_OPTIONS.map(t => (
                  <button key={t.id}
                    onClick={() => { setTone(t.id); setLanguage(t.lang) }}
                    className={clsx("py-1.5 rounded-lg text-xs font-medium border transition-all",
                      tone === t.id ? "bg-brand-red text-white border-brand-red" : "bg-white text-gray-600 border-gray-200 hover:border-brand-red"
                    )}>{t.label}</button>
                ))}
              </div>
            </div>

            {/* Style */}
            <div>
              <label className="label">أسلوب التعليق</label>
              <div className="space-y-1">
                {STYLE_OPTIONS.map(s => (
                  <button key={s.id} onClick={() => setStyle(s.id)}
                    className={clsx("w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm border transition-all text-left",
                      style === s.id ? "bg-brand-red/5 border-brand-red text-brand-red" : "bg-white border-gray-200 hover:border-gray-300"
                    )}>
                    <span className="font-semibold text-sm">{s.label}</span>
                    <span className="text-xs text-gray-400">{s.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Duration */}
            <div>
              <label className="label">مدة الفيديو</label>
              <div className="flex gap-1">
                {[15, 30, 60, 90].map(d => (
                  <button key={d} onClick={() => setDuration(d)}
                    className={clsx("flex-1 py-1.5 rounded-lg text-xs font-medium border transition-colors",
                      duration === d ? "bg-brand-red text-white border-brand-red" : "bg-white text-gray-600 border-gray-200"
                    )}>{d}s</button>
                ))}
              </div>
            </div>
          </div>

          <button onClick={generate} disabled={loading || !images.length}
            className="btn-primary w-full justify-center py-3">
            {loading
              ? <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />AI يحلل الصور...</>
              : "🎙 اكتب التعليق الصوتي"}
          </button>
        </div>

        {/* Right: result */}
        <div className="lg:col-span-3 space-y-3">
          {!result && !loading && (
            <div className="card p-12 text-center text-gray-300 h-full flex flex-col items-center justify-center">
              <p className="text-5xl mb-3">🎬</p>
              <p className="font-semibold text-gray-500">ارفع صور من فيديوك</p>
              <p className="text-sm mt-1 max-w-xs">سكرين شوتس، لقطات، أو صور من موقعك — AI يرى ما فيها ويكتب التعليق الصوتي المناسب</p>
            </div>
          )}

          {loading && (
            <div className="card p-12 text-center">
              <div className="w-12 h-12 border-4 border-brand-red border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <p className="font-semibold text-gray-700">AI يحلل الصور...</p>
              <p className="text-sm text-gray-400 mt-1">يقرأ المشاهد ويكتب تعليق صوتي احترافي</p>
            </div>
          )}

          {result && (
            <div className="space-y-3">
              {/* Hook */}
              <div className="card p-4 border-l-4 border-brand-red">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs font-bold text-brand-red uppercase tracking-wide">⚡ الهوك</p>
                  <button onClick={() => copyText(result.hook, "hook")} className="text-xs text-gray-400 hover:text-brand-red">
                    {copiedKey === "hook" ? "✓" : "نسخ"}
                  </button>
                </div>
                <p className="text-base font-bold text-gray-900" dir="auto">{result.hook}</p>
              </div>

              {/* Per-scene breakdown */}
              {result.sceneAnalysis?.length > 0 && (
                <div className="card p-4">
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">🎬 تحليل كل مشهد</p>
                  <div className="space-y-3">
                    {result.sceneAnalysis.map((scene: any, i: number) => (
                      <div key={i} className="flex gap-3">
                        {images[i] && (
                          <img src={images[i].url} alt="" className="w-20 h-14 object-cover rounded-lg shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-gray-400 mb-0.5">📍 {scene.whatISee}</p>
                          <p className="text-sm text-gray-800 font-medium leading-relaxed" dir="auto">{scene.voiceover}</p>
                        </div>
                        <button onClick={() => copyText(scene.voiceover, `scene-${i}`)}
                          className="text-xs text-gray-300 hover:text-brand-red shrink-0 self-start">
                          {copiedKey === `scene-${i}` ? "✓" : "نسخ"}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Full script */}
              <div className="card p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">📝 السكريبت الكامل</p>
                  <div className="flex gap-2">
                    <span className="text-xs text-gray-400">{result.estimatedDuration}</span>
                    <button onClick={() => copyText(result.fullScript, "full")}
                      className="text-xs text-gray-400 hover:text-brand-red">
                      {copiedKey === "full" ? "✓ تم" : "نسخ الكل"}
                    </button>
                  </div>
                </div>
                <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed" dir="auto">{result.fullScript}</p>
              </div>

              {/* CTA */}
              <div className="card p-4 border-l-4 border-brand-gold">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs font-bold text-brand-gold uppercase tracking-wide">🎯 CTA</p>
                  <button onClick={() => copyText(result.cta, "cta")} className="text-xs text-gray-400 hover:text-brand-red">
                    {copiedKey === "cta" ? "✓" : "نسخ"}
                  </button>
                </div>
                <p className="text-sm text-gray-800 font-medium" dir="auto">{result.cta}</p>
              </div>

              {/* Caption + hashtags */}
              {result.caption && (
                <div className="card p-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">📲 كابشن جاهز</p>
                    <button onClick={() => copyText(`${result.caption}\n\n${result.hashtags?.join(" ")}`, "caption")}
                      className="text-xs text-gray-400 hover:text-brand-red">
                      {copiedKey === "caption" ? "✓ تم" : "نسخ"}
                    </button>
                  </div>
                  <p className="text-sm text-gray-800 mb-3" dir="auto">{result.caption}</p>
                  {result.hashtags?.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {result.hashtags.map((h: string, i: number) => (
                        <span key={i} className="text-xs bg-brand-cream text-brand-red px-2 py-0.5 rounded-full">{h}</span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Filming note */}
              {result.filmingNote && (
                <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
                  <p className="text-xs font-bold text-blue-600 uppercase mb-1">🎥 ملاحظة التصوير</p>
                  <p className="text-sm text-blue-800" dir="auto">{result.filmingNote}</p>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2">
                <button onClick={saveToIdea} className="btn-gold flex-1 justify-center">
                  💾 حفظ في البايبلاين
                </button>
                <button onClick={() => copyText(
                  `${result.hook}\n\n${result.fullScript}\n\n${result.cta}\n\n---\n${result.caption}\n\n${result.hashtags?.join(" ")}`,
                  "everything"
                )} className="btn-secondary">
                  {copiedKey === "everything" ? "✓ تم" : "📋 نسخ كل شي"}
                </button>
                <button onClick={() => { setResult(null); setImages([]) }} className="btn-ghost">
                  🔄 من جديد
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
