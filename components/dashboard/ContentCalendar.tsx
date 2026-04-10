"use client"
import { useState, useMemo } from "react"
import { useStore } from "@/lib/store"
import clsx from "clsx"
import { SERIES_LABELS, VIBE_LABELS, STATUS_COLORS } from "@/lib/constants"
import type { ContentIdea, ContentStatus } from "@/types"

const STATUS_EMOJI: Record<ContentStatus, string> = {
  idea: "💡",
  scripted: "📝",
  filmed: "🎬",
  edited: "✂️",
  posted: "✅",
}

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

function getMonday(date: Date) {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  d.setDate(diff)
  d.setHours(0, 0, 0, 0)
  return d
}

function isoDate(d: Date) {
  return d.toISOString().split("T")[0]
}

export default function ContentCalendar() {
  const { contentIdeas, updateIdea } = useStore()
  const [weekOffset, setWeekOffset] = useState(0)
  const [dragging, setDragging] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState<string | null>(null)

  const monday = useMemo(() => {
    const m = getMonday(new Date())
    m.setDate(m.getDate() + weekOffset * 7)
    return m
  }, [weekOffset])

  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday)
      d.setDate(d.getDate() + i)
      return { date: isoDate(d), label: DAY_LABELS[i], d }
    })
  }, [monday])

  const weekLabel = `${monday.toLocaleDateString("en-GB", { day: "numeric", month: "short" })} – ${weekDays[6].d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`

  // Ideas scheduled this week
  const scheduledIdeas = useMemo(() => {
    const map: Record<string, ContentIdea[]> = {}
    weekDays.forEach(d => { map[d.date] = [] })
    contentIdeas.forEach(idea => {
      if (idea.scheduledDate && map[idea.scheduledDate]) {
        map[idea.scheduledDate].push(idea)
      }
    })
    return map
  }, [contentIdeas, weekDays])

  // Unscheduled ideas (backlog)
  const backlog = useMemo(() =>
    contentIdeas.filter(i => !i.scheduledDate && i.status !== "posted"),
    [contentIdeas]
  )

  function handleDrop(date: string) {
    if (!dragging) return
    updateIdea(dragging, { scheduledDate: date })
    setDragging(null)
    setDragOver(null)
  }

  function removeFromCalendar(id: string) {
    updateIdea(id, { scheduledDate: undefined })
  }

  const today = isoDate(new Date())

  // Post frequency stats
  const postedThisWeek = contentIdeas.filter(i =>
    i.scheduledDate && weekDays.some(d => d.date === i.scheduledDate) && i.status === "posted"
  ).length

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Content Calendar</h2>
          <p className="text-sm text-gray-400">Drag ideas onto days to schedule</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs bg-green-100 text-green-700 px-3 py-1 rounded-full font-medium">
            ✅ {postedThisWeek} posted this week
          </span>
          <button onClick={() => setWeekOffset(0)} className="btn-ghost text-xs">Today</button>
          <button onClick={() => setWeekOffset(w => w - 1)} className="btn-secondary px-2 py-1.5">‹</button>
          <span className="text-sm font-medium text-gray-700 min-w-48 text-center">{weekLabel}</span>
          <button onClick={() => setWeekOffset(w => w + 1)} className="btn-secondary px-2 py-1.5">›</button>
        </div>
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-2">
        {weekDays.map(({ date, label, d }) => {
          const isToday = date === today
          const isPast = date < today
          const dayIdeas = scheduledIdeas[date] || []

          return (
            <div key={date}
              onDragOver={e => { e.preventDefault(); setDragOver(date) }}
              onDragLeave={() => setDragOver(null)}
              onDrop={() => handleDrop(date)}
              className={clsx(
                "min-h-36 rounded-xl border-2 p-2 transition-all",
                isToday ? "border-brand-red bg-brand-red/5" : "border-gray-100 bg-white",
                dragOver === date ? "border-brand-gold bg-brand-gold/5 scale-[1.02]" : "",
                isPast && !isToday ? "opacity-60" : ""
              )}>
              {/* Day header */}
              <div className="mb-2">
                <p className={clsx("text-xs font-semibold", isToday ? "text-brand-red" : "text-gray-400")}>{label}</p>
                <p className={clsx("text-lg font-bold", isToday ? "text-brand-red" : "text-gray-800")}>
                  {d.getDate()}
                </p>
              </div>

              {/* Ideas */}
              <div className="space-y-1">
                {dayIdeas.map(idea => {
                  const sc = STATUS_COLORS[idea.status]
                  return (
                    <div key={idea.id}
                      draggable
                      onDragStart={() => setDragging(idea.id)}
                      onDragEnd={() => { setDragging(null); setDragOver(null) }}
                      className={clsx(
                        "text-xs rounded-lg px-2 py-1.5 cursor-grab active:cursor-grabbing group relative",
                        sc?.bg || "bg-gray-100",
                        sc?.text || "text-gray-700"
                      )}>
                      <p className="font-medium truncate pr-4">{STATUS_EMOJI[idea.status]} {idea.hook || "Untitled"}</p>
                      <p className="opacity-60 truncate">{idea.series}</p>
                      <button
                        onClick={() => removeFromCalendar(idea.id)}
                        className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 text-xs hover:text-red-500 transition-opacity">
                        ×
                      </button>
                    </div>
                  )
                })}
                {dayIdeas.length === 0 && (
                  <div className={clsx("text-xs text-center py-3 rounded-lg border-dashed border",
                    dragOver === date ? "border-brand-gold text-brand-gold" : "border-gray-200 text-gray-300"
                  )}>
                    {dragOver === date ? "Drop here" : "Empty"}
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Backlog */}
      <div className="card p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
            Content Backlog ({backlog.length})
          </p>
          <p className="text-xs text-gray-400">Drag onto calendar days above</p>
        </div>

        {backlog.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-4">All ideas are scheduled! 🎉</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {backlog.map(idea => {
              const sc = STATUS_COLORS[idea.status]
              return (
                <div key={idea.id}
                  draggable
                  onDragStart={() => setDragging(idea.id)}
                  onDragEnd={() => { setDragging(null); setDragOver(null) }}
                  className={clsx(
                    "rounded-xl px-3 py-2.5 cursor-grab active:cursor-grabbing border",
                    sc?.bg || "bg-gray-50",
                    sc?.border || "border-gray-200"
                  )}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className={clsx("text-sm font-semibold truncate", sc?.text || "text-gray-700")}>
                        {STATUS_EMOJI[idea.status]} {idea.hook || "Untitled hook"}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-gray-400">{idea.series}</span>
                        <span className="text-xs opacity-60">{idea.vibe}</span>
                      </div>
                    </div>
                    <span className={clsx("text-xs px-2 py-0.5 rounded-full font-medium shrink-0", sc?.bg, sc?.text)}>
                      {idea.status}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
