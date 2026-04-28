"use client"
import { useState, useEffect, useRef } from "react"
import { useStore } from "@/lib/store"
import { ARABIC_QUOTES, CHENGYU, SERIES_LABELS, VIBE_LABELS } from "@/lib/constants"
import { supabase } from "@/lib/supabase"
import clsx from "clsx"

// ── Daily rotation ─────────────────────────────────────────────
function getDailyIndex(len: number) {
  const start = new Date(new Date().getFullYear(), 0, 0).getTime()
  return Math.floor((Date.now() - start) / 86400000) % len
}
const dailyChengyu = () => CHENGYU[getDailyIndex(CHENGYU.length)]
const dailyQuote   = () => ARABIC_QUOTES[getDailyIndex(ARABIC_QUOTES.length)]

// ── Types ──────────────────────────────────────────────────────
interface AgentTask {
  id: string
  agent_id: string
  agent_name: string
  task_type: string
  input: string
  output: string
  status: "done" | "approved" | "rejected"
  created_at: string
}

interface ChatMessage {
  role: "user" | "agent"
  content: string
  ts: string
}

type ActivePanel = "omar" | "layla" | "ziad" | "nour" | "khalid" | null

// ── Agent definitions (UI layer) ───────────────────────────────
const AGENT_DEFS = [
  {
    id: "omar"   as const, name: "Omar",   role: "Morning Strategist",  avatar: "🧠",
    color: "#A51C1C", desc: "Analyzes your deals, streaks, and goals. Runs your daily brief.",
    inputHint: "Ask Omar anything or leave blank for morning brief…",
    buildBody: (input: string, ctx: any) => ({
      input: input || null,
      context: ctx,
    }),
  },
  {
    id: "layla"  as const, name: "Layla",  role: "Script Writer",       avatar: "✍️",
    color: "#7C3AED", desc: "Writes Arabic reel scripts — hooks, body, CTA, hashtags.",
    inputHint: "Topic for the script (e.g. Halal food in Chengdu)…",
    buildBody: (input: string) => ({
      topic: input,
      series: "city-series",
      vibe: "viral",
    }),
  },
  {
    id: "ziad"   as const, name: "Ziad",   role: "Trend Hunter",        avatar: "🔥",
    color: "#D97706", desc: "Scans RSS feeds and search to find what's trending in China now.",
    inputHint: "Focus query (optional, e.g. Beijing street food 2025)…",
    buildBody: (input: string) => ({
      query: input || "China content trends for Arab creators",
    }),
  },
  {
    id: "nour"   as const, name: "Nour",   role: "City Researcher",     avatar: "🗺️",
    color: "#059669", desc: "Fetches real data — attractions, halal food, markets — for any Chinese city.",
    inputHint: "City name (e.g. Kashgar, Harbin, Chengdu)…",
    buildBody: (input: string) => ({ city: input }),
  },
  {
    id: "khalid" as const, name: "Khalid", role: "Voiceover Director",  avatar: "🎙️",
    color: "#0284C7", desc: "Writes scene-by-scene Arabic voiceover scripts matched to your footage.",
    inputHint: "Describe your footage: location, what's visible, mood, duration…",
    buildBody: (input: string) => ({ screenshotDescription: input }),
  },
]

// ── Sub-components ─────────────────────────────────────────────

function StatTile({
  label, value, sub, onClick,
}: {
  label: string; value: string | number; sub?: string; onClick?: () => void
}) {
  return (
    <div
      className={clsx("metric-tile", onClick && "cursor-pointer hover:border-brand-red/40 transition-colors")}
      onClick={onClick}
    >
      <div className="metric-label">{label}</div>
      <div className="metric-value">{value}</div>
      {sub && <div className="metric-delta flat">{sub}</div>}
    </div>
  )
}

function AddTaskRow({ onAdd }: { onAdd: (t: string) => void }) {
  const [val, setVal] = useState("")
  return (
    <div className="flex gap-2 mt-1">
      <input
        className="input flex-1 text-sm"
        placeholder="Add task…"
        value={val}
        onChange={e => setVal(e.target.value)}
        onKeyDown={e => { if (e.key === "Enter" && val.trim()) { onAdd(val.trim()); setVal("") } }}
      />
      <button
        onClick={() => { if (val.trim()) { onAdd(val.trim()); setVal("") } }}
        className="btn-secondary px-3 shrink-0"
      >+</button>
    </div>
  )
}

// ── Agent slide panel ──────────────────────────────────────────
function AgentPanel({
  agent, open, onClose, storeContext,
}: {
  agent: typeof AGENT_DEFS[number] | null
  open: boolean
  onClose: () => void
  storeContext: any
}) {
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [chat, setChat] = useState<ChatMessage[]>([])
  const [history, setHistory] = useState<AgentTask[]>([])
  const [histLoading, setHistLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Reset + load history when panel opens
  useEffect(() => {
    if (!open || !agent) return
    setInput("")
    setChat([])
    setLoading(false)
    loadHistory()
    setTimeout(() => inputRef.current?.focus(), 320)
  }, [open, agent?.id])

  // Scroll to bottom on new message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [chat])

  async function loadHistory() {
    if (!agent) return
    setHistLoading(true)
    const { data } = await supabase
      .from("agent_tasks")
      .select("id,agent_name,task_type,output,status,created_at")
      .eq("agent_id", agent.id)
      .order("created_at", { ascending: false })
      .limit(3)
    if (data) setHistory(data as AgentTask[])
    setHistLoading(false)
  }

  async function send() {
    if (!agent || (!input.trim() && agent.id !== "omar" && agent.id !== "ziad")) return
    const userMsg = input.trim()
    setInput("")
    if (userMsg) setChat(c => [...c, { role: "user", content: userMsg, ts: new Date().toISOString() }])
    setLoading(true)
    try {
      const body = agent.buildBody(userMsg, storeContext)
      const res = await fetch(`/api/agents/${agent.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setChat(c => [...c, { role: "agent", content: data.output, ts: new Date().toISOString() }])
      loadHistory()
    } catch (e: any) {
      setChat(c => [...c, { role: "agent", content: `Error: ${e.message}`, ts: new Date().toISOString() }])
    }
    setLoading(false)
  }

  if (!agent) return null

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 bg-black/50 z-40 backdrop-blur-sm"
          onClick={() => { if (!loading) onClose() }}
        />
      )}

      {/* Panel */}
      <div
        className="fixed top-0 right-0 h-full w-full max-w-lg z-50 flex flex-col shadow-2xl"
        style={{
          backgroundColor: "#1A1A1A",
          borderLeft: "1px solid #2E2E2E",
          transform: open ? "translateX(0)" : "translateX(100%)",
          transition: "transform 300ms ease",
        }}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-surface-border shrink-0">
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center text-xl shrink-0"
            style={{ backgroundColor: agent.color + "22" }}
          >
            {agent.avatar}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-ink-primary">{agent.name}</p>
            <p className="text-2xs text-ink-muted">{agent.role}</p>
          </div>
          <button
            onClick={onClose}
            disabled={loading}
            className="text-ink-muted hover:text-ink-primary text-lg leading-none transition-colors"
          >✕</button>
        </div>

        {/* Chat area */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {/* Agent description (empty state) */}
          {chat.length === 0 && !loading && (
            <div className="rounded-lg px-4 py-3" style={{ backgroundColor: "#242424" }}>
              <p className="text-xs text-ink-muted leading-relaxed">{agent.desc}</p>
            </div>
          )}

          {/* Messages */}
          {chat.map((msg, i) => (
            <div
              key={i}
              className={clsx("flex gap-2", msg.role === "user" ? "justify-end" : "justify-start")}
            >
              {msg.role === "agent" && (
                <div className="w-6 h-6 rounded-md flex items-center justify-center text-sm shrink-0 mt-0.5"
                  style={{ backgroundColor: agent.color + "22" }}>
                  {agent.avatar}
                </div>
              )}
              <div
                className={clsx(
                  "max-w-[85%] rounded-xl px-3 py-2.5 text-sm leading-relaxed",
                  msg.role === "user"
                    ? "text-ink-primary"
                    : "text-ink-secondary"
                )}
                style={{
                  backgroundColor: msg.role === "user" ? "#2E2E2E" : "#242424",
                  whiteSpace: "pre-wrap",
                }}
              >
                {msg.content}
              </div>
            </div>
          ))}

          {/* Loading indicator */}
          {loading && (
            <div className="flex gap-2 justify-start">
              <div className="w-6 h-6 rounded-md flex items-center justify-center text-sm shrink-0"
                style={{ backgroundColor: agent.color + "22" }}>
                {agent.avatar}
              </div>
              <div className="rounded-xl px-4 py-3" style={{ backgroundColor: "#242424" }}>
                <div className="flex gap-1 items-center">
                  <span className="w-1.5 h-1.5 rounded-full bg-ink-muted animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-ink-muted animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-ink-muted animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Last 3 outputs */}
        {(history.length > 0 || histLoading) && (
          <div className="border-t border-surface-border px-5 py-3 shrink-0">
            <p className="text-2xs text-ink-muted uppercase tracking-wider mb-2">Recent outputs</p>
            {histLoading ? (
              <p className="text-xs text-ink-disabled">Loading…</p>
            ) : (
              <div className="space-y-1.5">
                {history.map(h => (
                  <button
                    key={h.id}
                    onClick={() => setChat(c => [...c, { role: "agent", content: h.output, ts: h.created_at }])}
                    className="w-full text-left rounded-lg px-3 py-2 transition-colors group"
                    style={{ backgroundColor: "#242424" }}
                    onMouseEnter={e => (e.currentTarget.style.backgroundColor = "#2E2E2E")}
                    onMouseLeave={e => (e.currentTarget.style.backgroundColor = "#242424")}
                  >
                    <p className="text-xs text-ink-secondary line-clamp-1">{h.output.slice(0, 90)}…</p>
                    <p className="text-2xs text-ink-disabled mt-0.5">{new Date(h.created_at).toLocaleDateString()}</p>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Input */}
        <div className="border-t border-surface-border px-4 py-3 shrink-0">
          <div className="flex gap-2">
            <input
              ref={inputRef}
              className="input flex-1 text-sm"
              placeholder={agent.inputHint}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send() } }}
              disabled={loading}
            />
            <button
              onClick={send}
              disabled={loading}
              className="btn-primary px-3 shrink-0"
              style={{ minWidth: 42 }}
            >
              {loading
                ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                : <SendIcon />}
            </button>
          </div>
          <p className="text-2xs text-ink-disabled mt-1.5">↵ Enter to send</p>
        </div>
      </div>
    </>
  )
}

function SendIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  )
}

// ── Main component ─────────────────────────────────────────────
interface Props {
  onNavigate: (tab: string) => void
  weather: { temp: string | number; emoji: string; description?: string } | null
}

export default function CompanyHQ({ onNavigate, weather }: Props) {
  const store = useStore()
  const chengyu = dailyChengyu()
  const quote   = dailyQuote()

  const [activePanel, setActivePanel] = useState<ActivePanel>(null)
  const [inboxTasks, setInboxTasks]   = useState<AgentTask[]>([])
  const [inboxLoading, setInboxLoading] = useState(false)
  const [rejectId, setRejectId]   = useState<string | null>(null)
  const [rejectNote, setRejectNote] = useState("")

  // ── Computed stats ─────────────────────────────────────────
  const latestIG    = store.followerLog[store.followerLog.length - 1]?.ig ?? 0
  const openDeals   = store.deals.filter(d => d.status !== "paid").length
  const activeProjs = store.projects.length
  const unusedClips = store.footage.filter(f => f.status === "unused").length

  // ── Greeting ───────────────────────────────────────────────
  const now       = new Date()
  const hour      = now.getHours()
  const greeting  = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening"
  const dayLabel  = now.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })

  // Store context passed to Omar
  const storeContext = {
    deals: store.deals,
    projects: store.projects,
    followerLog: store.followerLog,
    streaks: store.streaks,
    weeklyGoals: store.weeklyGoals,
    dailyFocus: store.dailyFocus,
  }

  // ── Inbox ──────────────────────────────────────────────────
  useEffect(() => { loadInbox() }, [])

  async function loadInbox() {
    setInboxLoading(true)
    const { data } = await supabase
      .from("agent_tasks")
      .select("*")
      .eq("status", "done")
      .order("created_at", { ascending: false })
      .limit(20)
    if (data) setInboxTasks(data as AgentTask[])
    setInboxLoading(false)
  }

  async function approveTask(id: string) {
    await supabase.from("agent_tasks").update({ status: "approved" }).eq("id", id)
    setInboxTasks(t => t.filter(x => x.id !== id))
  }

  async function rejectTask() {
    if (!rejectId) return
    await supabase
      .from("agent_tasks")
      .update({ status: "rejected", rejection_note: rejectNote || null })
      .eq("id", rejectId)
    setInboxTasks(t => t.filter(x => x.id !== rejectId))
    setRejectId(null)
    setRejectNote("")
  }

  const activeDef = AGENT_DEFS.find(a => a.id === activePanel) ?? null

  return (
    <div className="space-y-8 page-content">

      {/* ── Header ──────────────────────────────────────── */}
      <div>
        <p className="text-caption mb-1">
          {dayLabel}
          {weather && <span className="ml-2">{weather.emoji} {weather.temp}°C</span>}
        </p>
        <h1 className="text-display">{greeting}, Hesham</h1>
      </div>

      {/* ── 成语 + Quote ─────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="panel px-5 py-4 border-l-2 border-brand-red">
          <p className="text-2xs uppercase tracking-wider text-ink-muted mb-2">成语 of the Day</p>
          <p className="text-2xl font-bold text-ink-primary tracking-wider mb-1">{chengyu.zh}</p>
          <p className="text-xs text-ink-muted italic mb-2">{chengyu.pinyin}</p>
          <p className="text-sm text-ink-secondary">{chengyu.meaning}</p>
        </div>
        <div className="panel px-5 py-4 border-l-2 border-brand-gold">
          <p className="text-2xs uppercase tracking-wider text-ink-muted mb-2">Quote of the Day</p>
          <p className="text-xl font-bold text-ink-primary text-right leading-relaxed mb-2" dir="rtl">
            {quote.ar}
          </p>
          <p className="text-sm text-ink-secondary">{quote.en}</p>
        </div>
      </div>

      {/* ── Stats row ────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatTile
          label="Instagram"
          value={latestIG >= 1000 ? `${(latestIG / 1000).toFixed(1)}K` : latestIG || "—"}
          sub="followers"
          onClick={() => onNavigate("instagram")}
        />
        <StatTile
          label="Open Deals"
          value={openDeals}
          sub="in pipeline"
        />
        <StatTile
          label="Active Projects"
          value={activeProjs}
          sub="in progress"
          onClick={() => onNavigate("projects")}
        />
        <StatTile
          label="Unused Footage"
          value={unusedClips}
          sub="clips ready"
        />
      </div>

      {/* ── Your Team ─────────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-heading">Your Team</h2>
          <span className="text-2xs text-ink-muted">click any agent to open chat</span>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3">
          {AGENT_DEFS.map(agent => (
            <button
              key={agent.id}
              onClick={() => setActivePanel(agent.id)}
              className="agent-card text-left w-full hover:border-opacity-60 transition-all"
              style={{ borderColor: activePanel === agent.id ? agent.color : undefined }}
            >
              <div className="flex items-start gap-3 mb-3">
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center text-xl shrink-0"
                  style={{ backgroundColor: agent.color + "22" }}
                >
                  {agent.avatar}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-ink-primary">{agent.name}</p>
                  <p className="text-2xs text-ink-muted mt-0.5">{agent.role}</p>
                </div>
                <span className="text-2xs font-mono text-ink-disabled bg-surface-raised px-1.5 py-0.5 rounded">
                  {agent.id}
                </span>
              </div>
              <p className="text-xs text-ink-muted leading-relaxed mb-3">{agent.desc}</p>
              <div
                className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-medium transition-colors"
                style={{ backgroundColor: agent.color + "18", color: agent.color }}
              >
                <ChatBubbleIcon />
                Open Chat
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* ── Review Inbox ─────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <h2 className="text-heading">Review Inbox</h2>
            {inboxTasks.length > 0 && (
              <span className="badge badge-yellow">{inboxTasks.length}</span>
            )}
          </div>
          <button onClick={loadInbox} disabled={inboxLoading} className="btn-ghost text-xs">
            {inboxLoading ? "Loading…" : "Refresh"}
          </button>
        </div>

        <div className="panel overflow-hidden">
          {inboxLoading ? (
            <div className="px-6 py-10 text-center text-ink-muted text-sm">Loading tasks…</div>
          ) : inboxTasks.length === 0 ? (
            <div className="px-6 py-10 text-center">
              <div className="text-3xl mb-3">✅</div>
              <p className="text-subheading">Inbox zero</p>
              <p className="text-caption mt-1">No completed agent tasks to review</p>
            </div>
          ) : (
            <div>
              {inboxTasks.map(task => {
                const def = AGENT_DEFS.find(a => a.id === task.agent_id)
                return (
                  <div key={task.id} className="inbox-item">
                    <div className="w-1 self-stretch rounded-full shrink-0"
                      style={{ backgroundColor: def?.color ?? "#3A3A3A" }} />
                    <div
                      className="w-7 h-7 rounded-md flex items-center justify-center text-sm shrink-0"
                      style={{ backgroundColor: (def?.color ?? "#3A3A3A") + "22" }}
                    >
                      {def?.avatar ?? "🤖"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className="text-sm font-medium text-ink-primary">{task.agent_name}</p>
                        <span className="text-2xs text-ink-muted bg-surface-raised px-1.5 py-0.5 rounded">
                          {task.task_type}
                        </span>
                      </div>
                      <p className="text-xs text-ink-muted line-clamp-2">
                        {task.output.slice(0, 160)}…
                      </p>
                      <p className="text-2xs text-ink-disabled mt-1">
                        {new Date(task.created_at).toLocaleString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => approveTask(task.id)}
                        className="px-2.5 py-1 text-xs rounded-md font-semibold transition-opacity hover:opacity-80"
                        style={{ backgroundColor: "#0D2016", color: "#4ADE80" }}
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => { setRejectId(task.id); setRejectNote("") }}
                        className="px-2.5 py-1 text-xs rounded-md font-semibold transition-opacity hover:opacity-80"
                        style={{ backgroundColor: "#250808", color: "#F87171" }}
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Reject note modal */}
        {rejectId && (
          <>
            <div className="fixed inset-0 bg-black/60 z-50 backdrop-blur-sm"
              onClick={() => setRejectId(null)} />
            <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-sm"
              style={{ backgroundColor: "#1A1A1A", border: "1px solid #3A3A3A", borderRadius: 12, padding: 20 }}>
              <p className="text-sm font-semibold text-ink-primary mb-3">Reject — add a note (optional)</p>
              <textarea
                className="input w-full text-sm resize-none mb-3"
                rows={3}
                placeholder="Why are you rejecting this output?"
                value={rejectNote}
                onChange={e => setRejectNote(e.target.value)}
                autoFocus
              />
              <div className="flex gap-2">
                <button onClick={rejectTask} className="btn-primary flex-1 justify-center"
                  style={{ backgroundColor: "#7f1d1d" }}>
                  Confirm Reject
                </button>
                <button onClick={() => setRejectId(null)} className="btn-secondary">Cancel</button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* ── Today's Focus + Streaks ────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Focus */}
        <div className="lg:col-span-2 panel p-5">
          <h3 className="text-heading mb-4">Today's Focus</h3>
          <input
            className="input text-base font-medium mb-4"
            placeholder="What's your #1 mission today?"
            value={store.dailyFocus?.mainMission || ""}
            onChange={e => store.setMainMission(e.target.value)}
          />
          <div className="space-y-2">
            {store.dailyFocus?.checklist.map(item => (
              <div key={item.id}
                className="flex items-center gap-3 group px-1 py-0.5 rounded-lg hover:bg-surface-raised transition-colors">
                <input
                  type="checkbox"
                  checked={item.done}
                  onChange={() => store.toggleChecklistItem(item.id)}
                  className="w-4 h-4 rounded border-surface-border bg-surface-raised accent-brand-red shrink-0"
                />
                <span className={clsx(
                  "flex-1 text-sm",
                  item.done ? "line-through text-ink-disabled" : "text-ink-secondary"
                )}>
                  {item.text}
                </span>
                <button
                  onClick={() => store.deleteChecklistItem(item.id)}
                  className="opacity-0 group-hover:opacity-100 text-ink-disabled hover:text-status-red-text text-xs transition-opacity"
                >✕</button>
              </div>
            ))}
            <AddTaskRow onAdd={t => store.addChecklistItem(t)} />
          </div>
        </div>

        {/* Streaks */}
        <div className="panel p-5">
          <h3 className="text-heading mb-4">Streaks</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-caption">Posting</p>
                <p className="text-3xl font-bold text-orange-400 mt-1">{store.streaks.postingStreak}</p>
                <p className="text-2xs text-ink-muted mt-0.5">days</p>
              </div>
              <div>
                <p className="text-caption">Check-in</p>
                <p className="text-3xl font-bold text-status-green-text mt-1">{store.streaks.checkinStreak}</p>
                <p className="text-2xs text-ink-muted mt-0.5">days</p>
              </div>
            </div>
            <div className="divider" />
            <button
              onClick={store.markPostedToday}
              className={clsx(
                "w-full py-2.5 rounded-lg text-sm font-semibold transition-all",
                store.streaks.lastPostedDate === new Date().toISOString().split("T")[0]
                  ? "cursor-default"
                  : "btn-primary justify-center"
              )}
              style={
                store.streaks.lastPostedDate === new Date().toISOString().split("T")[0]
                  ? { backgroundColor: "#0D2016", color: "#4ADE80" }
                  : {}
              }
            >
              {store.streaks.lastPostedDate === new Date().toISOString().split("T")[0]
                ? "✓ Posted today"
                : "Mark Posted Today"}
            </button>
          </div>
        </div>
      </div>

      {/* ── Quick Capture pending ──────────────────────── */}
      {store.captures.filter(c => !c.processed).length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-heading">Quick Capture</h3>
            <span className="badge badge-muted">
              {store.captures.filter(c => !c.processed).length} pending
            </span>
          </div>
          <div className="panel divide-y divide-surface-border">
            {store.captures.filter(c => !c.processed).slice(0, 5).map(c => (
              <div key={c.id} className="inbox-item">
                <div className="w-1 self-stretch rounded-full bg-surface-border shrink-0" />
                <p className="flex-1 text-sm text-ink-secondary">{c.text}</p>
                <p className="text-2xs text-ink-muted shrink-0">
                  {new Date(c.createdAt).toLocaleDateString()}
                </p>
                <div className="flex gap-1">
                  <button
                    onClick={() => store.processCapture(c.id)}
                    className="btn-ghost text-xs py-1 px-2 text-status-green-text"
                  >Done</button>
                  <button
                    onClick={() => store.deleteCapture(c.id)}
                    className="btn-ghost text-xs py-1 px-2 text-ink-disabled"
                  >✕</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Agent slide panel ─────────────────────────── */}
      <AgentPanel
        agent={activeDef}
        open={activePanel !== null}
        onClose={() => setActivePanel(null)}
        storeContext={storeContext}
      />
    </div>
  )
}

function ChatBubbleIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  )
}
