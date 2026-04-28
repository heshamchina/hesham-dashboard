"use client"
import { useState, useEffect } from "react"
import clsx from "clsx"
import { supabase } from "@/lib/supabase"

// ── Types ─────────────────────────────────────────────────────────────────────
interface ScrapeConfig {
  id: string
  type: "account" | "hashtag"
  target: string
  label: string | null
  active: boolean
}

interface ScrapeResult {
  id: string
  type: "account" | "hashtag"
  target: string
  data: any[]
  scraped_at: string
}

interface ZiadTask {
  id: string
  output: string
  created_at: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const timeAgo = (iso: string) => {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

export default function Scraper() {
  const [configs, setConfigs] = useState<ScrapeConfig[]>([])
  const [results, setResults] = useState<ScrapeResult[]>([])
  const [ziadTasks, setZiadTasks] = useState<ZiadTask[]>([])
  const [running, setRunning] = useState(false)
  const [log, setLog] = useState<string[]>([])
  const [activeAnalysis, setActiveAnalysis] = useState<string | null>(null)
  const [configTab, setConfigTab] = useState<"account" | "hashtag">("account")
  const [newTarget, setNewTarget] = useState("")
  const [newLabel, setNewLabel] = useState("")
  const [saving, setSaving] = useState(false)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const [cfgRes, resRes, ziadRes] = await Promise.all([
      supabase.from("scrape_config").select("*").order("created_at"),
      supabase.from("scrape_results").select("id, type, target, scraped_at, data").order("scraped_at", { ascending: false }).limit(30),
      supabase.from("agent_tasks").select("id, output, created_at").eq("agent_id", "ziad").order("created_at", { ascending: false }).limit(5),
    ])
    if (cfgRes.data) setConfigs(cfgRes.data)
    if (resRes.data) setResults(resRes.data)
    if (ziadRes.data) setZiadTasks(ziadRes.data)
    if (ziadRes.data?.[0]) setActiveAnalysis(ziadRes.data[0].output)
  }

  async function runDaily() {
    setRunning(true)
    setLog(["Starting daily scrape run..."])
    try {
      const res = await fetch("/api/scrape/run-daily", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${process.env.NEXT_PUBLIC_CRON_SECRET || "hc_cron_2025"}`,
        },
      })
      const d = await res.json()
      setLog(d.log || ["Done"])
      if (d.errors?.length) setLog(l => [...l, ...d.errors.map((e: string) => `⚠ ${e}`)])
      await loadData()
    } catch (e: any) {
      setLog(l => [...l, `Error: ${e.message}`])
    }
    setRunning(false)
  }

  async function runSingle(target: string, type: "account" | "hashtag") {
    setRunning(true)
    setLog([`Scraping ${type === "hashtag" ? "#" : "@"}${target}...`])
    try {
      const res = await fetch("/api/scrape/instagram", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targets: [target], type }),
      })
      const d = await res.json()
      if (d.ok) {
        setLog([`✓ Got ${d.count} posts from ${type === "hashtag" ? "#" : "@"}${target}`])
        // Save to DB manually since this bypasses run-daily
        await supabase.from("scrape_results").insert({ type, target, data: d.items, scraped_at: new Date().toISOString() })
        await loadData()
      } else {
        setLog([`✗ ${d.error}`])
      }
    } catch (e: any) {
      setLog([`Error: ${e.message}`])
    }
    setRunning(false)
  }

  async function toggleActive(cfg: ScrapeConfig) {
    await supabase.from("scrape_config").update({ active: !cfg.active }).eq("id", cfg.id)
    setConfigs(c => c.map(x => x.id === cfg.id ? { ...x, active: !x.active } : x))
  }

  async function deleteConfig(id: string) {
    await supabase.from("scrape_config").delete().eq("id", id)
    setConfigs(c => c.filter(x => x.id !== id))
  }

  async function addConfig() {
    if (!newTarget.trim()) return
    setSaving(true)
    const { data } = await supabase
      .from("scrape_config")
      .insert({ type: configTab, target: newTarget.trim().replace(/^[@#]/, ""), label: newLabel.trim() || null, active: true })
      .select()
      .single()
    if (data) setConfigs(c => [...c, data])
    setNewTarget("")
    setNewLabel("")
    setSaving(false)
  }

  const accounts  = configs.filter(c => c.type === "account")
  const hashtags  = configs.filter(c => c.type === "hashtag")
  const myResults = results.filter(r => r.target === "heshaminchina")
  const lastRun   = results[0]?.scraped_at

  return (
    <div className="space-y-6 page-content">

      {/* ── Header ──────────────────────────────────────────────── */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-display">Instagram Scraper</h1>
          <p className="text-caption mt-1">
            {lastRun ? `Last run ${timeAgo(lastRun)}` : "Never run"} · {configs.filter(c => c.active).length} active targets
          </p>
        </div>
        <button
          onClick={runDaily}
          disabled={running}
          className="btn-primary gap-2"
        >
          {running ? (
            <><span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Running...</>
          ) : (
            <><RunIcon /> Run Full Scrape</>
          )}
        </button>
      </div>

      {/* ── Run log ─────────────────────────────────────────────── */}
      {log.length > 0 && (
        <div className="panel p-4 font-mono text-xs space-y-1">
          {log.map((line, i) => (
            <div key={i} className={clsx(
              line.startsWith("✓") ? "text-status-green-text" :
              line.startsWith("✗") || line.startsWith("⚠") || line.startsWith("Error") ? "text-status-red-text" :
              "text-ink-muted"
            )}>
              {line}
            </div>
          ))}
          {running && <div className="text-ink-disabled animate-pulse">...</div>}
        </div>
      )}

      {/* ── Main grid ───────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Left: config ──────────────────────────────────────── */}
        <div className="lg:col-span-1 space-y-4">

          {/* Tab switcher */}
          <div className="panel p-1 flex gap-1">
            {(["account", "hashtag"] as const).map(t => (
              <button
                key={t}
                onClick={() => setConfigTab(t)}
                className={clsx("flex-1 py-1.5 rounded-md text-xs font-medium transition-colors",
                  configTab === t ? "bg-surface-raised text-ink-primary" : "text-ink-muted hover:text-ink-secondary"
                )}
              >
                {t === "account" ? "👤 Accounts" : "# Hashtags"}
              </button>
            ))}
          </div>

          {/* Target list */}
          <div className="panel divide-y divide-surface-border">
            {(configTab === "account" ? accounts : hashtags).map(cfg => {
              const lastScrape = results.find(r => r.target === cfg.target)
              return (
                <div key={cfg.id} className="flex items-center gap-3 px-3 py-2.5 group">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={clsx("text-xs font-mono font-medium",
                        cfg.target === "heshaminchina" ? "text-brand-gold" : "text-ink-primary"
                      )}>
                        {configTab === "account" ? "@" : "#"}{cfg.target}
                      </span>
                      {cfg.target === "heshaminchina" && (
                        <span className="badge badge-gold text-[9px] py-0">you</span>
                      )}
                    </div>
                    {cfg.label && <p className="text-2xs text-ink-muted">{cfg.label}</p>}
                    {lastScrape && (
                      <p className="text-2xs text-ink-disabled">{timeAgo(lastScrape.scraped_at)} · {lastScrape.data?.length ?? 0} posts</p>
                    )}
                  </div>

                  {/* Toggle active */}
                  <button
                    onClick={() => toggleActive(cfg)}
                    className={clsx("w-7 h-4 rounded-full transition-colors shrink-0",
                      cfg.active ? "bg-status-green-text/40" : "bg-surface-border"
                    )}
                    title={cfg.active ? "Active" : "Paused"}
                  >
                    <span className={clsx("block w-3 h-3 rounded-full bg-white shadow transition-transform mx-0.5",
                      cfg.active ? "translate-x-3" : "translate-x-0"
                    )} />
                  </button>

                  {/* Quick scrape */}
                  <button
                    onClick={() => runSingle(cfg.target, cfg.type)}
                    disabled={running}
                    className="btn-ghost text-xs py-1 px-2 opacity-0 group-hover:opacity-100"
                    title="Scrape now"
                  >▶</button>

                  {/* Delete (not for own account) */}
                  {cfg.target !== "heshaminchina" && (
                    <button
                      onClick={() => deleteConfig(cfg.id)}
                      className="btn-ghost text-xs py-1 px-1.5 opacity-0 group-hover:opacity-100 text-status-red-text"
                    >✕</button>
                  )}
                </div>
              )
            })}

            {(configTab === "account" ? accounts : hashtags).length === 0 && (
              <div className="px-3 py-6 text-center text-ink-disabled text-xs">
                No {configTab === "account" ? "accounts" : "hashtags"} added yet
              </div>
            )}
          </div>

          {/* Add new */}
          <div className="panel p-3 space-y-2">
            <p className="text-2xs text-ink-muted uppercase tracking-wider font-semibold">
              Add {configTab === "account" ? "Account" : "Hashtag"}
            </p>
            <input
              className="input text-sm"
              placeholder={configTab === "account" ? "username (no @)" : "hashtag (no #)"}
              value={newTarget}
              onChange={e => setNewTarget(e.target.value)}
              onKeyDown={e => e.key === "Enter" && addConfig()}
            />
            <input
              className="input text-sm"
              placeholder="Label (optional)"
              value={newLabel}
              onChange={e => setNewLabel(e.target.value)}
              onKeyDown={e => e.key === "Enter" && addConfig()}
            />
            <button onClick={addConfig} disabled={saving || !newTarget.trim()} className="btn-secondary w-full text-xs justify-center">
              {saving ? "Adding..." : `Add ${configTab === "account" ? "Account" : "Hashtag"}`}
            </button>
          </div>
        </div>

        {/* Right: results + analysis ──────────────────────────── */}
        <div className="lg:col-span-2 space-y-4">

          {/* My account stats */}
          {myResults.length > 0 && (
            <div className="panel p-4">
              <p className="text-2xs text-ink-muted uppercase tracking-wider font-semibold mb-3">@heshaminchina — Last Scrape</p>
              <div className="grid grid-cols-3 gap-3">
                {(() => {
                  const posts = myResults[0]?.data ?? []
                  const avgLikes = posts.length
                    ? Math.round(posts.reduce((s: number, p: any) => s + (p.likesCount ?? 0), 0) / posts.length)
                    : 0
                  const avgComments = posts.length
                    ? Math.round(posts.reduce((s: number, p: any) => s + (p.commentsCount ?? 0), 0) / posts.length)
                    : 0
                  const reels = posts.filter((p: any) => (p.type ?? "").toLowerCase().includes("reel") || (p.mediaType ?? "").includes("VIDEO")).length
                  return (
                    <>
                      <div className="metric-tile">
                        <div className="metric-label">Posts analyzed</div>
                        <div className="metric-value text-2xl">{posts.length}</div>
                      </div>
                      <div className="metric-tile">
                        <div className="metric-label">Avg likes</div>
                        <div className="metric-value text-2xl">{avgLikes.toLocaleString()}</div>
                      </div>
                      <div className="metric-tile">
                        <div className="metric-label">Reels</div>
                        <div className="metric-value text-2xl">{reels}</div>
                        <div className="metric-delta flat">{posts.length - reels} photos/carousels</div>
                      </div>
                    </>
                  )
                })()}
              </div>
            </div>
          )}

          {/* Recent scrape results table */}
          <div className="panel overflow-hidden">
            <div className="px-4 py-3 border-b border-surface-border">
              <p className="text-2xs text-ink-muted uppercase tracking-wider font-semibold">Recent Scrapes</p>
            </div>
            {results.length === 0 ? (
              <div className="px-4 py-8 text-center text-ink-disabled text-sm">
                No scrapes yet — run a full scrape to populate data
              </div>
            ) : (
              <div className="divide-y divide-surface-border">
                {results.slice(0, 10).map(r => (
                  <div key={r.id} className="flex items-center gap-3 px-4 py-2.5">
                    <span className={clsx("text-xs font-mono",
                      r.type === "hashtag" ? "text-brand-gold" : "text-ink-secondary"
                    )}>
                      {r.type === "hashtag" ? "#" : "@"}{r.target}
                    </span>
                    <span className="flex-1 text-2xs text-ink-muted">{r.data?.length ?? 0} posts</span>
                    <span className="text-2xs text-ink-disabled">{timeAgo(r.scraped_at)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Ziad's analysis */}
          <div className="panel overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-surface-border">
              <div className="flex items-center gap-2">
                <span>🔥</span>
                <p className="text-2xs text-ink-muted uppercase tracking-wider font-semibold">Ziad's Analysis</p>
              </div>
              {ziadTasks.length > 1 && (
                <select
                  className="input text-xs py-0.5 px-2 w-auto"
                  onChange={e => setActiveAnalysis(ziadTasks.find(t => t.id === e.target.value)?.output || "")}
                >
                  {ziadTasks.map((t, i) => (
                    <option key={t.id} value={t.id}>
                      {i === 0 ? "Latest" : timeAgo(t.created_at)}
                    </option>
                  ))}
                </select>
              )}
            </div>
            <div className="p-4">
              {activeAnalysis ? (
                <p className="text-sm text-ink-secondary leading-relaxed whitespace-pre-wrap">{activeAnalysis}</p>
              ) : (
                <div className="py-8 text-center">
                  <p className="text-3xl mb-3">🔥</p>
                  <p className="text-sm text-ink-muted">No analysis yet</p>
                  <p className="text-xs text-ink-disabled mt-1">Run a full scrape to get Ziad's competitive intelligence report</p>
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}

function RunIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <polygon points="5 3 19 12 5 21 5 3" />
    </svg>
  )
}
