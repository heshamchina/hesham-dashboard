"use client"
import { useEffect, useMemo, useState } from "react"
import clsx from "clsx"
import type { DashboardReminder } from "@/lib/reminders"

interface Props {
  reminders: DashboardReminder[]
  onNavigate: (tab: string) => void
  onExecute?: (reminder: DashboardReminder) => void
  onCreatePlan?: (reminders: DashboardReminder[]) => void
}

const PRIORITY_STYLE = {
  high: "border-status-red-text/50 bg-status-red-bg/40",
  medium: "border-status-yellow-text/40 bg-status-yellow-bg/35",
  low: "border-status-blue-text/30 bg-status-blue-bg/20",
}

const PRIORITY_LABEL = {
  high: "High",
  medium: "Medium",
  low: "Low",
}

export default function OperatingView({ reminders, onNavigate, onExecute, onCreatePlan }: Props) {
  const top = reminders.slice(0, 6)
  const [adviceMap, setAdviceMap] = useState<Record<string, string>>({})
  const [loadingAdvice, setLoadingAdvice] = useState(false)

  const reminderDigest = useMemo(
    () => top.map(r => ({ id: r.id, title: r.title, detail: r.detail, priority: r.priority, tab: r.tab })),
    [top]
  )

  useEffect(() => {
    if (top.length === 0) {
      setAdviceMap({})
      return
    }
    void generateAdvice(false)
  }, [top.length, JSON.stringify(reminderDigest)])

  async function generateAdvice(force = true) {
    if (top.length === 0) return
    if (!force && Object.keys(adviceMap).length >= top.length) return
    setLoadingAdvice(true)
    try {
      const prompt = [
        "Generate one next-best action for each reminder.",
        "Return strict JSON only as an object where key is reminder id and value is a short action line.",
        "Rules: max 90 chars per action, imperative style, concrete, no fluff.",
        `Reminders: ${JSON.stringify(reminderDigest)}`,
      ].join("\n")

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId: "omar",
          memoryContext: { type: "general", id: "operating-view" },
          context: {},
          messages: [{ role: "user", content: prompt }],
        }),
      })

      const data = await res.json()
      const reply = typeof data.reply === "string" ? data.reply.trim() : ""

      const jsonStart = reply.indexOf("{")
      const jsonEnd = reply.lastIndexOf("}")
      if (jsonStart >= 0 && jsonEnd > jsonStart) {
        const parsed = JSON.parse(reply.slice(jsonStart, jsonEnd + 1))
        if (parsed && typeof parsed === "object") {
          const nextMap: Record<string, string> = {}
          Object.entries(parsed).forEach(([k, v]) => {
            if (typeof v === "string") nextMap[k] = v
          })
          setAdviceMap(nextMap)
        }
      }
    } catch {
      // Keep UI usable without AI advice.
    } finally {
      setLoadingAdvice(false)
    }
  }

  return (
    <div className="panel p-5 space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-heading">Daily Operating View</h2>
          <p className="text-caption mt-1">Single place for the next best actions across deals, clients, content, and projects.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onCreatePlan?.(top.slice(0, 3))}
            className="btn-secondary text-xs"
            disabled={top.length === 0}
          >
            Create today plan
          </button>
          <button
            onClick={() => void generateAdvice(true)}
            className="btn-ghost text-xs"
            disabled={loadingAdvice || top.length === 0}
          >
            {loadingAdvice ? "Generating..." : "Refresh AI actions"}
          </button>
          <span className="badge badge-muted">{reminders.length} active signals</span>
        </div>
      </div>

      {top.length === 0 ? (
        <div className="rounded-xl px-4 py-5 border border-status-green-text/30 bg-status-green-bg/25">
          <p className="text-sm font-semibold text-status-green-text">All systems healthy</p>
          <p className="text-xs text-ink-secondary mt-1">No urgent reminders right now. Keep execution momentum.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {top.map(item => (
            <button
              key={item.id}
              onClick={() => onNavigate(item.tab)}
              className={clsx(
                "text-left rounded-xl px-4 py-3 border transition-colors hover:border-brand-red/60",
                PRIORITY_STYLE[item.priority]
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-ink-primary">{item.title}</p>
                <span className="text-2xs text-ink-muted">{PRIORITY_LABEL[item.priority]}</span>
              </div>
              <p className="text-xs text-ink-secondary mt-1 line-clamp-2">{item.detail}</p>
              {adviceMap[item.id] && (
                <p className="text-xs mt-2 text-brand-gold line-clamp-2">Omar: {adviceMap[item.id]}</p>
              )}
              <div className="mt-2 flex items-center justify-between gap-2">
                <span className="text-2xs text-brand-gold">Open {item.tab}</span>
                <button
                  type="button"
                  className="text-2xs px-2 py-1 rounded-md border border-surface-border hover:border-brand-red/60 text-ink-secondary"
                  onClick={e => {
                    e.stopPropagation()
                    onExecute?.(item)
                  }}
                >
                  Execute
                </button>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
