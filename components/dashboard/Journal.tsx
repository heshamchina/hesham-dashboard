"use client"
import { useState } from "react"
import { useStore } from "@/lib/store"
import clsx from "clsx"
import type { JournalEntry } from "@/types"

const MOOD_CONFIG = [
  { value: 1, emoji: "😔", label: "Rough" },
  { value: 2, emoji: "😐", label: "Meh" },
  { value: 3, emoji: "🙂", label: "Okay" },
  { value: 4, emoji: "😊", label: "Good" },
  { value: 5, emoji: "🔥", label: "Amazing" },
] as const

const today = () => new Date().toISOString().split("T")[0]

const EMPTY: Omit<JournalEntry, "id"> = {
  date: today(),
  wins: "",
  struggles: "",
  lessons: "",
  gratitude: "",
  tomorrowFocus: "",
  mood: 3,
}

export default function Journal() {
  const { journalEntries, saveJournalEntry, deleteJournalEntry } = useStore()
  const [view, setView] = useState<"write" | "history">("write")
  const [form, setForm] = useState<Omit<JournalEntry, "id">>(() => {
    const existing = journalEntries.find(e => e.date === today())
    return existing ? { ...existing } : { ...EMPTY }
  })
  const [saved, setSaved] = useState(false)

  function handleSave() {
    saveJournalEntry(form)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const moodAvg = journalEntries.length > 0
    ? (journalEntries.slice(0, 7).reduce((s, e) => s + e.mood, 0) / Math.min(journalEntries.length, 7)).toFixed(1)
    : null

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Daily Journal</h2>
          <p className="text-sm text-gray-400">Reflect. Learn. Grow.</p>
        </div>
        <div className="flex items-center gap-3">
          {moodAvg && (
            <div className="text-center bg-brand-cream rounded-lg px-3 py-1">
              <p className="text-xs text-gray-500">7-day avg mood</p>
              <p className="font-bold text-brand-red">{moodAvg}/5</p>
            </div>
          )}
          <div className="flex bg-gray-100 rounded-lg p-0.5">
            <button onClick={() => setView("write")}
              className={clsx("px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
                view === "write" ? "bg-white shadow text-gray-900" : "text-gray-500"
              )}>Write</button>
            <button onClick={() => setView("history")}
              className={clsx("px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
                view === "history" ? "bg-white shadow text-gray-900" : "text-gray-500"
              )}>History ({journalEntries.length})</button>
          </div>
        </div>
      </div>

      {view === "write" && (
        <div className="card p-5 space-y-4">
          {/* Date + Mood */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <input type="date" className="input w-40 text-sm" value={form.date}
                onChange={e => {
                  const existing = journalEntries.find(j => j.date === e.target.value)
                  setForm(existing ? { ...existing } : { ...EMPTY, date: e.target.value })
                }} />
              <span className="text-sm text-gray-400">
                {new Date(form.date).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}
              </span>
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-1 text-center">How was today?</p>
              <div className="flex gap-1">
                {MOOD_CONFIG.map(m => (
                  <button key={m.value} onClick={() => setForm(f => ({ ...f, mood: m.value as 1|2|3|4|5 }))}
                    title={m.label}
                    className={clsx("w-9 h-9 rounded-lg text-lg transition-all",
                      form.mood === m.value
                        ? "bg-brand-red/10 ring-2 ring-brand-red scale-110"
                        : "hover:bg-gray-100"
                    )}>
                    {m.emoji}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Journal fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label text-green-600">🏆 Wins today</label>
              <textarea className="input h-24 resize-none text-sm" placeholder="What went well? Big or small..."
                value={form.wins} onChange={e => setForm(f => ({ ...f, wins: e.target.value }))} />
            </div>
            <div>
              <label className="label text-red-500">💥 Struggles</label>
              <textarea className="input h-24 resize-none text-sm" placeholder="What was hard? Where did you get stuck?"
                value={form.struggles} onChange={e => setForm(f => ({ ...f, struggles: e.target.value }))} />
            </div>
            <div>
              <label className="label text-blue-600">💡 Lessons learned</label>
              <textarea className="input h-24 resize-none text-sm" placeholder="What will you do differently?"
                value={form.lessons} onChange={e => setForm(f => ({ ...f, lessons: e.target.value }))} />
            </div>
            <div>
              <label className="label text-yellow-600">🙏 Gratitude</label>
              <textarea className="input h-24 resize-none text-sm" placeholder="3 things you're grateful for..."
                value={form.gratitude} onChange={e => setForm(f => ({ ...f, gratitude: e.target.value }))} />
            </div>
            <div className="sm:col-span-2">
              <label className="label text-brand-red">🎯 Tomorrow's focus</label>
              <textarea className="input h-20 resize-none text-sm" placeholder="What's the #1 thing you MUST do tomorrow?"
                value={form.tomorrowFocus} onChange={e => setForm(f => ({ ...f, tomorrowFocus: e.target.value }))} />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button onClick={handleSave}
              className={clsx("btn-primary transition-all", saved && "bg-green-600 hover:bg-green-700")}>
              {saved ? "✓ Saved!" : "Save Entry"}
            </button>
            <p className="text-xs text-gray-400">Auto-saves by date. Writing same date overwrites.</p>
          </div>
        </div>
      )}

      {view === "history" && (
        <div className="space-y-3">
          {journalEntries.length === 0 && (
            <div className="card p-8 text-center text-gray-400">
              <p className="text-3xl mb-2">📔</p>
              <p className="font-medium">No entries yet</p>
              <p className="text-sm mt-1">Start writing your daily journal</p>
            </div>
          )}
          {journalEntries.map(entry => {
            const mood = MOOD_CONFIG.find(m => m.value === entry.mood)
            return (
              <div key={entry.id} className="card p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{mood?.emoji}</span>
                    <div>
                      <p className="font-semibold text-gray-900">
                        {new Date(entry.date).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}
                      </p>
                      <p className="text-xs text-gray-400">{mood?.label} day</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => { setForm({ ...entry }); setView("write") }}
                      className="text-xs text-brand-red hover:text-brand-red-dark font-medium">Edit</button>
                    <button onClick={() => deleteJournalEntry(entry.id)}
                      className="text-gray-300 hover:text-red-400 text-sm">✕</button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  {entry.wins && (
                    <div className="bg-green-50 rounded-lg p-3">
                      <p className="text-xs font-semibold text-green-600 mb-1">🏆 Wins</p>
                      <p className="text-gray-700 text-xs leading-relaxed">{entry.wins}</p>
                    </div>
                  )}
                  {entry.struggles && (
                    <div className="bg-red-50 rounded-lg p-3">
                      <p className="text-xs font-semibold text-red-500 mb-1">💥 Struggles</p>
                      <p className="text-gray-700 text-xs leading-relaxed">{entry.struggles}</p>
                    </div>
                  )}
                  {entry.lessons && (
                    <div className="bg-blue-50 rounded-lg p-3">
                      <p className="text-xs font-semibold text-blue-600 mb-1">💡 Lessons</p>
                      <p className="text-gray-700 text-xs leading-relaxed">{entry.lessons}</p>
                    </div>
                  )}
                  {entry.tomorrowFocus && (
                    <div className="bg-brand-cream rounded-lg p-3">
                      <p className="text-xs font-semibold text-brand-red mb-1">🎯 Next focus</p>
                      <p className="text-gray-700 text-xs leading-relaxed">{entry.tomorrowFocus}</p>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
