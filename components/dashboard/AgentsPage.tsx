"use client"
import { useState, useEffect, useRef } from "react"
import { useStore } from "@/lib/store"
import { supabase } from "@/lib/supabase"
import { AGENTS } from "@/lib/agents"
import ClientAgentsHub from "@/components/dashboard/ClientAgentsHub"
import clsx from "clsx"

// ── Types ──────────────────────────────────────────────────────
interface MeetingMessage {
  agentId: string
  agentName: string
  content: string
  createdAt: string
}

interface AgentTask {
  id: string
  agent_id: string
  agent_name: string
  task_type: string
  input: string | null
  output: string
  status: string
  rejection_note: string | null
  created_at: string
}

interface ChatMessage {
  role: "user" | "assistant"
  content: string
}

// ── Per-agent chat panel ────────────────────────────────────────
const AGENT_DEFS = AGENTS.map(a => ({
  ...a,
  buildBody: (input: string) => {
    if (a.id === "omar")    return { input: input || null, context: {} }
    if (a.id === "layla")   return { topic: input, series: "city-series", vibe: "viral" }
    if (a.id === "ziad")    return { query: input || "What is trending in China content for Arab audiences?" }
    if (a.id === "nour")    return { city: input }
    if (a.id === "khalid")  return { screenshotDescription: input }
    return { input }
  },
}))

function AgentChatPanel({
  agent,
  onClose,
}: {
  agent: typeof AGENT_DEFS[0]
  onClose: () => void
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [pastOutputs, setPastOutputs] = useState<AgentTask[]>([])
  const [expanded, setExpanded] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    supabase
      .from("agent_tasks")
      .select("*")
      .eq("agent_id", agent.id)
      .order("created_at", { ascending: false })
      .limit(3)
      .then(({ data }) => setPastOutputs(data || []))
  }, [agent.id])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, loading])

  async function send() {
    const text = input.trim()
    if (!text || loading) return
    setInput("")
    setMessages(m => [...m, { role: "user", content: text }])
    setLoading(true)
    try {
      const res = await fetch(agent.apiRoute, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(agent.buildBody(text)),
      })
      const json = await res.json()
      const reply =
        json.script || json.output || json.brief || json.trends ||
        json.research || json.voiceover || json.result ||
        (typeof json === "string" ? json : JSON.stringify(json))
      setMessages(m => [...m, { role: "assistant", content: reply }])
    } catch {
      setMessages(m => [...m, { role: "assistant", content: "Error — agent unavailable." }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="fixed inset-y-0 right-0 z-50 flex flex-col"
      style={{
        width: "min(520px, 100vw)",
        background: "#141414",
        borderLeft: "1px solid #2A2A2A",
        boxShadow: "-8px 0 40px rgba(0,0,0,0.6)",
      }}
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-surface-border shrink-0">
        <span className="text-2xl">{agent.avatar}</span>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-ink-primary">{agent.name}</p>
          <p className="text-xs text-ink-muted">{agent.role}</p>
        </div>
        <button
          onClick={onClose}
          className="text-ink-muted hover:text-ink-primary transition-colors text-lg leading-none"
        >✕</button>
      </div>

      {/* Past outputs */}
      {pastOutputs.length > 0 && (
        <div className="px-4 py-3 border-b border-surface-border shrink-0">
          <p className="text-xs text-ink-muted mb-2 uppercase tracking-wide">Recent outputs</p>
          <div className="space-y-1.5">
            {pastOutputs.map(t => (
              <button
                key={t.id}
                onClick={() => setExpanded(expanded === t.id ? null : t.id)}
                className="w-full text-left text-xs rounded-lg px-3 py-2 transition-colors"
                style={{ background: "#1E1E1E", border: "1px solid #2A2A2A" }}
              >
                <div className="flex justify-between items-center">
                  <span className="text-ink-secondary truncate pr-2">
                    {t.input ? t.input.slice(0, 40) + (t.input.length > 40 ? "…" : "") : t.task_type}
                  </span>
                  <span className="text-ink-muted shrink-0">
                    {new Date(t.created_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}
                  </span>
                </div>
                {expanded === t.id && (
                  <p className="mt-2 text-ink-muted whitespace-pre-wrap leading-relaxed">
                    {t.output.slice(0, 400)}{t.output.length > 400 ? "…" : ""}
                  </p>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 min-h-0">
        {messages.length === 0 && (
          <p className="text-center text-ink-muted text-sm mt-8 opacity-60">
            {agent.role} — ask anything
          </p>
        )}
        {messages.map((m, i) => (
          <div key={i} className={clsx("flex", m.role === "user" ? "justify-end" : "justify-start")}>
            {m.role === "assistant" && (
              <span className="text-lg mr-2 mt-0.5 shrink-0">{agent.avatar}</span>
            )}
            <div
              className="max-w-[85%] rounded-xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap"
              style={
                m.role === "user"
                  ? { background: "#A51C1C", color: "#fff" }
                  : { background: "#1E1E1E", color: "#D0D0D0", border: "1px solid #2A2A2A" }
              }
            >
              {m.content}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex items-center gap-2">
            <span className="text-lg">{agent.avatar}</span>
            <div className="flex gap-1">
              {[0, 1, 2].map(i => (
                <span
                  key={i}
                  className="w-1.5 h-1.5 rounded-full"
                  style={{
                    background: "#707070",
                    animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite`,
                  }}
                />
              ))}
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-4 py-4 border-t border-surface-border shrink-0">
        <div className="flex gap-2">
          <input
            className="flex-1 text-sm rounded-lg px-3 py-2.5 outline-none"
            style={{ background: "#1E1E1E", border: "1px solid #2A2A2A", color: "#F0F0F0" }}
            placeholder={`Message ${agent.name}…`}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && !e.shiftKey && send()}
            disabled={loading}
          />
          <button
            onClick={send}
            disabled={loading || !input.trim()}
            className="px-4 py-2 rounded-lg text-sm font-semibold transition-opacity disabled:opacity-40"
            style={{ background: "#A51C1C", color: "#fff" }}
          >
            Send
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Meeting Room panel ──────────────────────────────────────────
function MeetingRoom({ onClose, storeContext }: { onClose: () => void; storeContext: any }) {
  const [topic, setTopic] = useState("")
  const [phase, setPhase] = useState<"idle" | "running" | "done">("idle")
  const [messages, setMessages] = useState<MeetingMessage[]>([])
  const [error, setError] = useState("")
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  const AVATARS: Record<string, string> = {
    omar: "🧠", layla: "✍️", ziad: "🔥", nour: "🗺️", khalid: "🎙️",
  }

  async function startMeeting() {
    if (!topic.trim() || phase === "running") return
    setPhase("running")
    setMessages([])
    setError("")

    try {
      // Phase 1: create session
      const r1 = await fetch("/api/meeting", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: topic.trim() }),
      })
      const { sessionId, error: e1 } = await r1.json()
      if (e1 || !sessionId) throw new Error(e1 || "Failed to create session")

      // Phase 2: run agents
      const r2 = await fetch("/api/meeting", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, context: storeContext }),
      })
      const { messages: msgs, error: e2 } = await r2.json()
      if (e2) throw new Error(e2)

      setMessages(msgs || [])
      setPhase("done")
    } catch (err: any) {
      setError(err.message || "Meeting failed")
      setPhase("idle")
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}
    >
      <div
        className="flex flex-col rounded-2xl overflow-hidden"
        style={{
          width: "min(680px, 96vw)",
          maxHeight: "90vh",
          background: "#141414",
          border: "1px solid #2A2A2A",
          boxShadow: "0 24px 60px rgba(0,0,0,0.7)",
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-surface-border shrink-0">
          <div>
            <h3 className="font-bold text-lg text-ink-primary">Meeting Room</h3>
            <p className="text-xs text-ink-muted mt-0.5">All 5 agents respond in sequence</p>
          </div>
          <button onClick={onClose} className="text-ink-muted hover:text-ink-primary text-lg">✕</button>
        </div>

        {/* Topic input */}
        <div className="px-6 py-4 border-b border-surface-border shrink-0">
          <div className="flex gap-3">
            <input
              className="flex-1 rounded-lg px-4 py-2.5 text-sm outline-none"
              style={{ background: "#1E1E1E", border: "1px solid #2A2A2A", color: "#F0F0F0" }}
              placeholder="Meeting topic — e.g. 'Content strategy for Canton Fair'"
              value={topic}
              onChange={e => setTopic(e.target.value)}
              onKeyDown={e => e.key === "Enter" && startMeeting()}
              disabled={phase === "running"}
            />
            <button
              onClick={startMeeting}
              disabled={phase === "running" || !topic.trim()}
              className="px-5 py-2.5 rounded-lg text-sm font-bold transition-all disabled:opacity-40 shrink-0"
              style={{ background: "#A51C1C", color: "#fff" }}
            >
              {phase === "running" ? "Running…" : "Start Meeting"}
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5 min-h-0">
          {phase === "idle" && messages.length === 0 && (
            <p className="text-center text-ink-muted text-sm py-12 opacity-60">
              Enter a topic and start the meeting
            </p>
          )}
          {phase === "running" && messages.length === 0 && (
            <div className="flex flex-col items-center gap-4 py-12">
              <div className="flex gap-2">
                {["🧠", "🔥", "🗺️", "✍️", "🎙️"].map((a, i) => (
                  <span
                    key={i}
                    className="text-2xl"
                    style={{ animation: `bounce 1.2s ease-in-out ${i * 0.25}s infinite` }}
                  >{a}</span>
                ))}
              </div>
              <p className="text-sm text-ink-muted">Agents are thinking…</p>
            </div>
          )}
          {error && (
            <p className="text-center text-red-400 text-sm py-4">{error}</p>
          )}
          {messages.map((m, i) => (
            <div key={i} className="flex gap-3">
              <span className="text-xl shrink-0 mt-0.5">
                {AVATARS[m.agentId] || "🤖"}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2 mb-1.5">
                  <span className="text-sm font-semibold text-ink-primary">{m.agentName}</span>
                  <span className="text-xs text-ink-muted">
                    {AGENTS.find(a => a.id === m.agentId)?.role}
                  </span>
                </div>
                <div
                  className="rounded-xl px-4 py-3 text-sm leading-relaxed text-ink-secondary whitespace-pre-wrap"
                  style={{ background: "#1A1A1A", border: "1px solid #252525" }}
                >
                  {m.content}
                </div>
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
      </div>
    </div>
  )
}

// ── AgentsPage ──────────────────────────────────────────────────
interface Props {
  onNavigate: (id: string) => void
}

const STATUS_FILTERS = ["all", "pending", "done", "approved", "rejected"] as const
type StatusFilter = typeof STATUS_FILTERS[number]

export default function AgentsPage({ onNavigate }: Props) {
  const store = useStore()
  const [meetingOpen, setMeetingOpen] = useState(false)
  const [activeAgent, setActiveAgent] = useState<typeof AGENT_DEFS[0] | null>(null)
  const [tasks, setTasks] = useState<AgentTask[]>([])
  const [loadingTasks, setLoadingTasks] = useState(true)
  const [agentFilter, setAgentFilter] = useState<string>("all")
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all")

  // Store context for meeting
  const storeContext = {
    deals: store.deals,
    streaks: store.streaks,
    projects: store.projects,
    followerLog: store.followerLog,
  }

  useEffect(() => {
    loadTasks()
  }, [])

  async function loadTasks() {
    setLoadingTasks(true)
    const { data } = await supabase
      .from("agent_tasks")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100)
    setTasks(data || [])
    setLoadingTasks(false)
  }

  const filteredTasks = tasks.filter(t => {
    if (agentFilter !== "all" && t.agent_id !== agentFilter) return false
    if (statusFilter !== "all" && t.status !== statusFilter) return false
    return true
  })

  const STATUS_COLORS: Record<string, string> = {
    pending: "#D4A017",
    done: "#6366f1",
    approved: "#22c55e",
    rejected: "#ef4444",
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-display">Agents</h2>
        <p className="text-sm text-ink-muted mt-0.5">Your AI team — 5 agents, one room</p>
      </div>

      {/* Meeting Room CTA */}
      <button
        onClick={() => setMeetingOpen(true)}
        className="w-full flex items-center justify-between rounded-2xl px-6 py-5 transition-all hover:scale-[1.01] active:scale-[0.99]"
        style={{
          background: "linear-gradient(135deg, #A51C1C 0%, #7A1414 100%)",
          boxShadow: "0 8px 32px rgba(165,28,28,0.4)",
        }}
      >
        <div className="flex items-center gap-4">
          <span className="text-3xl">🏛️</span>
          <div className="text-left">
            <p className="font-bold text-white text-lg">Meeting Room</p>
            <p className="text-sm text-red-200 opacity-80">All 5 agents — one conversation</p>
          </div>
        </div>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white"
          strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.7">
          <path d="M5 12h14M12 5l7 7-7 7" />
        </svg>
      </button>

      {/* Agent rows */}
      <div className="space-y-2">
        <p className="text-xs font-semibold text-ink-muted uppercase tracking-widest px-1">Your Agents</p>
        {AGENT_DEFS.map(agent => (
          <button
            key={agent.id}
            onClick={() => setActiveAgent(agent)}
            className="w-full flex items-center gap-4 rounded-xl px-4 py-3.5 transition-all text-left group"
            style={{ background: "#1A1A1A", border: "1px solid #252525" }}
          >
            <span className="text-2xl shrink-0">{agent.avatar}</span>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-ink-primary text-sm">{agent.name}</p>
              <p className="text-xs text-ink-muted truncate">{agent.role}</p>
            </div>
            <svg
              width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#505050"
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              className="shrink-0 group-hover:stroke-ink-secondary transition-colors"
            >
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </button>
        ))}
      </div>

      {/* Client agents workflow */}
      <ClientAgentsHub />

      {/* Task history */}
      <div className="space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <p className="text-xs font-semibold text-ink-muted uppercase tracking-widest">Task History</p>
          <button onClick={loadTasks} className="text-xs text-ink-muted hover:text-ink-secondary transition-colors">
            ↻ Refresh
          </button>
        </div>

        {/* Filters */}
        <div className="flex gap-2 flex-wrap">
          {/* Agent filter */}
          <select
            value={agentFilter}
            onChange={e => setAgentFilter(e.target.value)}
            className="text-xs rounded-lg px-3 py-1.5 outline-none"
            style={{ background: "#1A1A1A", border: "1px solid #2A2A2A", color: "#A0A0A0" }}
          >
            <option value="all">All agents</option>
            {AGENTS.map(a => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>

          {/* Status filter */}
          <div className="flex rounded-lg overflow-hidden" style={{ border: "1px solid #2A2A2A" }}>
            {STATUS_FILTERS.map(s => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className="px-3 py-1.5 text-xs font-medium transition-colors capitalize"
                style={
                  statusFilter === s
                    ? { background: "#2E2E2E", color: "#F0F0F0" }
                    : { background: "#1A1A1A", color: "#606060" }
                }
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Task list */}
        {loadingTasks ? (
          <p className="text-sm text-ink-muted text-center py-8">Loading…</p>
        ) : filteredTasks.length === 0 ? (
          <div className="text-center py-12 text-ink-muted">
            <p className="text-3xl mb-2">📭</p>
            <p className="text-sm">No tasks match this filter</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredTasks.map(task => (
              <div
                key={task.id}
                className="rounded-xl px-4 py-3.5"
                style={{ background: "#1A1A1A", border: "1px solid #252525" }}
              >
                <div className="flex items-start justify-between gap-3 mb-1.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-base shrink-0">
                      {AGENTS.find(a => a.id === task.agent_id)?.avatar || "🤖"}
                    </span>
                    <span className="text-sm font-medium text-ink-primary">{task.agent_name}</span>
                    <span className="text-xs text-ink-muted">· {task.task_type}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className="text-xs font-medium px-2 py-0.5 rounded-full"
                      style={{
                        background: `${STATUS_COLORS[task.status] || "#444"}22`,
                        color: STATUS_COLORS[task.status] || "#888",
                        border: `1px solid ${STATUS_COLORS[task.status] || "#444"}44`,
                      }}
                    >
                      {task.status}
                    </span>
                    <span className="text-xs text-ink-muted">
                      {new Date(task.created_at).toLocaleDateString("en-GB", {
                        day: "2-digit", month: "short",
                      })}
                    </span>
                  </div>
                </div>
                {task.input && (
                  <p className="text-xs text-ink-muted mb-1.5 truncate">
                    Input: {task.input.slice(0, 80)}{task.input.length > 80 ? "…" : ""}
                  </p>
                )}
                <p className="text-sm text-ink-secondary leading-relaxed line-clamp-3">
                  {task.output}
                </p>
                {task.rejection_note && (
                  <p className="mt-1.5 text-xs text-red-400 italic">
                    Rejection note: {task.rejection_note}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Panels */}
      {meetingOpen && (
        <MeetingRoom onClose={() => setMeetingOpen(false)} storeContext={storeContext} />
      )}
      {activeAgent && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            style={{ background: "rgba(0,0,0,0.4)" }}
            onClick={() => setActiveAgent(null)}
          />
          <div
            className="fixed inset-0 z-50 transition-transform duration-300"
            style={{ transform: activeAgent ? "translateX(0)" : "translateX(100%)" }}
          >
            <AgentChatPanel
              agent={activeAgent}
              onClose={() => setActiveAgent(null)}
            />
          </div>
        </>
      )}
    </div>
  )
}
