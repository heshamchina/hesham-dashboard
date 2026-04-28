"use client"
import { useState, useEffect } from "react"
import { useStore } from "@/lib/store"
import { supabase } from "@/lib/supabase"
import { AGENTS } from "@/lib/agents"
import type { AffiliateCat } from "@/types"

// ── Types ──────────────────────────────────────────────────────
interface ScrapeTarget {
  id: string
  type: "account" | "hashtag"
  target: string
  active: boolean
  label: string | null
  created_at: string
}

interface ReportToggle {
  agentId: string
  enabled: boolean
  frequency: "daily" | "weekly"
}

const LINK_CATS: { id: AffiliateCat; label: string; icon: string }[] = [
  { id: "hotel",      label: "Hotel",      icon: "🏨" },
  { id: "flight",     label: "Flight",     icon: "✈️" },
  { id: "train",      label: "Train",      icon: "🚄" },
  { id: "attraction", label: "Attraction", icon: "🎭" },
  { id: "other",      label: "Other",      icon: "🔗" },
]

const SETTINGS_TABS = [
  { id: "scrape",   label: "Scrape Targets", icon: "🔍" },
  { id: "reports",  label: "Scheduled Reports", icon: "📋" },
  { id: "links",    label: "Quick Links", icon: "🔗" },
  { id: "revenue",  label: "Revenue", icon: "💰" },
]

// ── Default report toggles (one per agent) ────────────────────
const defaultToggles = (): ReportToggle[] =>
  AGENTS.map(a => ({ agentId: a.id, enabled: false, frequency: "daily" }))

export default function SettingsPage() {
  const store = useStore()
  const [activeTab, setActiveTab] = useState("scrape")

  // ── Scrape targets ────────────────────────────────────────────
  const [targets, setTargets] = useState<ScrapeTarget[]>([])
  const [targetsLoaded, setTargetsLoaded] = useState(false)
  const [targetsLoading, setTargetsLoading] = useState(false)
  const [showAddTarget, setShowAddTarget] = useState(false)
  const [newTarget, setNewTarget] = useState({ type: "account" as "account" | "hashtag", target: "", label: "" })

  // ── Report toggles ────────────────────────────────────────────
  const [reportToggles, setReportToggles] = useState<ReportToggle[]>(defaultToggles)

  // ── Quick links ───────────────────────────────────────────────
  const [showAddLink, setShowAddLink] = useState(false)
  const [editLinkId, setEditLinkId] = useState<string | null>(null)
  const [linkForm, setLinkForm] = useState({ title: "", url: "", category: "other" as AffiliateCat, commission: "" })

  // ── Revenue settings ──────────────────────────────────────────
  const [revenueForm, setRevenueForm] = useState({
    monthlyTarget: store.revenueSettings.monthlyTarget,
    currency: store.revenueSettings.currency,
    staleAlertDays: store.revenueSettings.staleAlertDays,
  })
  const [revenueSaved, setRevenueSaved] = useState(false)

  useEffect(() => {
    if (activeTab === "scrape" && !targetsLoaded) loadTargets()
  }, [activeTab])

  // ── Scrape helpers ────────────────────────────────────────────
  async function loadTargets() {
    setTargetsLoading(true)
    const { data } = await supabase
      .from("scrape_config")
      .select("*")
      .order("created_at", { ascending: false })
    setTargets(data || [])
    setTargetsLoaded(true)
    setTargetsLoading(false)
  }

  async function addTarget() {
    if (!newTarget.target.trim()) return
    const { data } = await supabase.from("scrape_config").insert({
      type: newTarget.type,
      target: newTarget.target.trim().replace(/^[@#]/, ""),
      label: newTarget.label.trim() || null,
      active: true,
    }).select().single()
    if (data) setTargets(t => [data, ...t])
    setNewTarget({ type: "account", target: "", label: "" })
    setShowAddTarget(false)
  }

  async function toggleTarget(id: string, active: boolean) {
    await supabase.from("scrape_config").update({ active }).eq("id", id)
    setTargets(ts => ts.map(t => t.id === id ? { ...t, active } : t))
  }

  async function deleteTarget(id: string) {
    await supabase.from("scrape_config").delete().eq("id", id)
    setTargets(ts => ts.filter(t => t.id !== id))
  }

  // ── Link helpers ──────────────────────────────────────────────
  function openNewLink() {
    setLinkForm({ title: "", url: "", category: "other", commission: "" })
    setEditLinkId(null)
    setShowAddLink(true)
  }

  function openEditLink(id: string) {
    const link = store.affiliateLinks.find(l => l.id === id)
    if (!link) return
    setLinkForm({ title: link.title, url: link.url, category: link.category, commission: link.commission || "" })
    setEditLinkId(id)
    setShowAddLink(true)
  }

  function saveLink() {
    if (!linkForm.title.trim() || !linkForm.url.trim()) return
    if (editLinkId) {
      store.updateAffiliateLink(editLinkId, linkForm)
    } else {
      store.addAffiliateLink(linkForm)
    }
    setShowAddLink(false)
    setEditLinkId(null)
  }

  function saveRevenue() {
    store.setRevenueSettings(revenueForm)
    setRevenueSaved(true)
    setTimeout(() => setRevenueSaved(false), 2000)
  }

  // ── Shared toggle style ───────────────────────────────────────
  function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
    return (
      <button
        onClick={() => onChange(!checked)}
        className="relative w-10 h-6 rounded-full transition-colors shrink-0"
        style={{ background: checked ? "#A51C1C" : "#2A2A2A", border: "1px solid #3A3A3A" }}
      >
        <span
          className="absolute top-0.5 w-5 h-5 rounded-full transition-all"
          style={{
            background: "#F0F0F0",
            left: checked ? "calc(100% - 22px)" : "2px",
          }}
        />
      </button>
    )
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-display">Settings</h2>
        <p className="text-sm text-ink-muted mt-0.5">Configure scrape targets, reports, and quick links</p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 p-1 border border-surface-border rounded-xl overflow-x-auto" style={{ backgroundColor: "#1A1A1A" }}>
        {SETTINGS_TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all"
            style={activeTab === t.id
              ? { background: "#A51C1C", color: "#fff" }
              : { color: "#707070" }}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* ════════════════════════════════════════════════ */}
      {/* SCRAPE TARGETS                                  */}
      {/* ════════════════════════════════════════════════ */}
      {activeTab === "scrape" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-ink-muted uppercase tracking-widest">
              Instagram Accounts & Hashtags
            </p>
            <button
              onClick={() => setShowAddTarget(!showAddTarget)}
              className="px-3 py-1.5 rounded-lg text-xs font-bold"
              style={{ background: "#A51C1C", color: "#fff" }}
            >
              + Add Target
            </button>
          </div>

          {showAddTarget && (
            <div className="rounded-2xl p-4 space-y-3" style={{ background: "#1A1A1A", border: "1px solid #252525" }}>
              <div className="flex gap-2 flex-wrap">
                <select
                  value={newTarget.type}
                  onChange={e => setNewTarget(t => ({ ...t, type: e.target.value as "account" | "hashtag" }))}
                  className="input w-auto text-xs"
                >
                  <option value="account">@ Account</option>
                  <option value="hashtag"># Hashtag</option>
                </select>
                <input
                  className="input flex-1 text-xs"
                  placeholder={newTarget.type === "account" ? "anoodinchina" : "chinawithme"}
                  value={newTarget.target}
                  onChange={e => setNewTarget(t => ({ ...t, target: e.target.value }))}
                />
                <input
                  className="input w-32 text-xs"
                  placeholder="Label (optional)"
                  value={newTarget.label}
                  onChange={e => setNewTarget(t => ({ ...t, label: e.target.value }))}
                />
              </div>
              <div className="flex gap-2">
                <button onClick={addTarget} className="btn-primary text-xs py-1.5">Save</button>
                <button onClick={() => setShowAddTarget(false)} className="btn-secondary text-xs py-1.5">Cancel</button>
              </div>
            </div>
          )}

          <div className="rounded-2xl overflow-hidden" style={{ background: "#1A1A1A", border: "1px solid #252525" }}>
            {targetsLoading ? (
              <p className="text-center text-sm text-ink-muted py-8">Loading…</p>
            ) : targets.length === 0 ? (
              <p className="text-center text-sm text-ink-muted py-8">No targets configured</p>
            ) : (
              <div className="divide-y divide-surface-border">
                {targets.map(target => (
                  <div key={target.id} className="flex items-center gap-3 px-4 py-3">
                    <span
                      className="text-xs px-2 py-0.5 rounded-full font-mono shrink-0"
                      style={{
                        background: target.type === "account" ? "#0D2016" : "#251D08",
                        color: target.type === "account" ? "#4ADE80" : "#D4A017",
                      }}
                    >
                      {target.type === "account" ? "@" : "#"}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-ink-primary truncate">
                        {target.type === "account" ? "@" : "#"}{target.target}
                        {target.label && (
                          <span className="text-ink-muted ml-2 text-xs">— {target.label}</span>
                        )}
                      </p>
                      <p className="text-xs text-ink-muted">
                        Added {new Date(target.created_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                      </p>
                    </div>
                    <Toggle checked={target.active} onChange={v => toggleTarget(target.id, v)} />
                    <button
                      onClick={() => deleteTarget(target.id)}
                      className="text-ink-muted hover:text-red-400 text-sm transition-colors shrink-0"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════ */}
      {/* SCHEDULED REPORTS                               */}
      {/* ════════════════════════════════════════════════ */}
      {activeTab === "reports" && (
        <div className="space-y-3">
          <p className="text-xs font-semibold text-ink-muted uppercase tracking-widest">
            Automated report triggers per agent
          </p>
          <div className="rounded-2xl overflow-hidden" style={{ background: "#1A1A1A", border: "1px solid #252525" }}>
            {AGENTS.map((agent, i) => {
              const toggle = reportToggles.find(t => t.agentId === agent.id)!
              return (
                <div
                  key={agent.id}
                  className="flex items-center gap-4 px-4 py-4"
                  style={{ borderBottom: i < AGENTS.length - 1 ? "1px solid #252525" : "none" }}
                >
                  <span className="text-xl shrink-0">{agent.avatar}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-ink-primary">{agent.name}</p>
                    <p className="text-xs text-ink-muted">{agent.role}</p>
                  </div>
                  {toggle.enabled && (
                    <select
                      value={toggle.frequency}
                      onChange={e => setReportToggles(ts =>
                        ts.map(t => t.agentId === agent.id ? { ...t, frequency: e.target.value as "daily" | "weekly" } : t)
                      )}
                      className="text-xs rounded-lg px-2 py-1 outline-none shrink-0"
                      style={{ background: "#242424", border: "1px solid #2E2E2E", color: "#A0A0A0" }}
                    >
                      <option value="daily">Daily</option>
                      <option value="weekly">Weekly</option>
                    </select>
                  )}
                  <Toggle
                    checked={toggle.enabled}
                    onChange={v => setReportToggles(ts =>
                      ts.map(t => t.agentId === agent.id ? { ...t, enabled: v } : t)
                    )}
                  />
                </div>
              )
            })}
          </div>
          <p className="text-xs text-ink-muted text-center px-4">
            Scheduled reports fire on the configured cadence and save to agent_tasks for review in the Home inbox.
          </p>
        </div>
      )}

      {/* ════════════════════════════════════════════════ */}
      {/* QUICK LINKS                                     */}
      {/* ════════════════════════════════════════════════ */}
      {activeTab === "links" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-ink-muted uppercase tracking-widest">
              Affiliate & Quick Links ({store.affiliateLinks.length})
            </p>
            <button
              onClick={openNewLink}
              className="px-3 py-1.5 rounded-lg text-xs font-bold"
              style={{ background: "#A51C1C", color: "#fff" }}
            >
              + Add Link
            </button>
          </div>

          {/* Add/Edit form */}
          {showAddLink && (
            <div className="rounded-2xl p-4 space-y-3" style={{ background: "#1A1A1A", border: "1px solid #252525" }}>
              <p className="text-sm font-semibold text-ink-primary">{editLinkId ? "Edit Link" : "New Link"}</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Title</label>
                  <input className="input" placeholder="Silk Road Hotel" value={linkForm.title}
                    onChange={e => setLinkForm(f => ({ ...f, title: e.target.value }))} />
                </div>
                <div>
                  <label className="label">Category</label>
                  <select className="input" value={linkForm.category}
                    onChange={e => setLinkForm(f => ({ ...f, category: e.target.value as AffiliateCat }))}>
                    {LINK_CATS.map(c => (
                      <option key={c.id} value={c.id}>{c.icon} {c.label}</option>
                    ))}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="label">URL</label>
                  <input className="input" placeholder="https://booking.com/..." value={linkForm.url}
                    onChange={e => setLinkForm(f => ({ ...f, url: e.target.value }))} />
                </div>
                <div className="col-span-2">
                  <label className="label">Commission (optional)</label>
                  <input className="input" placeholder="5% or $10/booking" value={linkForm.commission}
                    onChange={e => setLinkForm(f => ({ ...f, commission: e.target.value }))} />
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={saveLink} className="btn-primary text-xs py-1.5">Save</button>
                <button onClick={() => { setShowAddLink(false); setEditLinkId(null) }} className="btn-secondary text-xs py-1.5">Cancel</button>
              </div>
            </div>
          )}

          {/* Links list */}
          {store.affiliateLinks.length === 0 ? (
            <div className="text-center py-12 text-ink-muted">
              <p className="text-3xl mb-2">🔗</p>
              <p className="text-sm">No links yet</p>
            </div>
          ) : (
            <div className="rounded-2xl overflow-hidden" style={{ background: "#1A1A1A", border: "1px solid #252525" }}>
              {store.affiliateLinks.map((link, i) => {
                const cat = LINK_CATS.find(c => c.id === link.category)
                return (
                  <div
                    key={link.id}
                    className="flex items-center gap-3 px-4 py-3 group"
                    style={{ borderBottom: i < store.affiliateLinks.length - 1 ? "1px solid #252525" : "none" }}
                  >
                    <span className="text-lg shrink-0">{cat?.icon || "🔗"}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-ink-primary truncate">{link.title}</p>
                      <p className="text-xs text-ink-muted truncate">{link.url}</p>
                    </div>
                    {link.commission && (
                      <span className="text-xs px-2 py-0.5 rounded-full shrink-0"
                        style={{ background: "#251D08", color: "#D4A017" }}>
                        {link.commission}
                      </span>
                    )}
                    <div className="flex items-center gap-2 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                      <a href={link.url} target="_blank" rel="noopener"
                        className="text-xs text-ink-muted hover:text-ink-secondary transition-colors">
                        ↗
                      </a>
                      <button onClick={() => openEditLink(link.id)}
                        className="text-xs text-ink-muted hover:text-ink-secondary transition-colors">
                        ✎
                      </button>
                      <button onClick={() => store.deleteAffiliateLink(link.id)}
                        className="text-xs text-ink-muted hover:text-red-400 transition-colors">
                        ✕
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════════════ */}
      {/* REVENUE SETTINGS                                */}
      {/* ════════════════════════════════════════════════ */}
      {activeTab === "revenue" && (
        <div className="space-y-4">
          <p className="text-xs font-semibold text-ink-muted uppercase tracking-widest">Revenue Targets & Alerts</p>
          <div className="rounded-2xl p-5 space-y-4" style={{ background: "#1A1A1A", border: "1px solid #252525" }}>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Monthly Target ($)</label>
                <input
                  className="input"
                  type="number"
                  value={revenueForm.monthlyTarget}
                  onChange={e => setRevenueForm(f => ({ ...f, monthlyTarget: parseInt(e.target.value) || 0 }))}
                />
              </div>
              <div>
                <label className="label">Currency</label>
                <select className="input" value={revenueForm.currency}
                  onChange={e => setRevenueForm(f => ({ ...f, currency: e.target.value }))}>
                  {["USD", "JOD", "CNY", "SAR", "AED", "EUR"].map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div className="col-span-2">
                <label className="label">Stale Deal Alert (days)</label>
                <input
                  className="input"
                  type="number"
                  min={1}
                  value={revenueForm.staleAlertDays}
                  onChange={e => setRevenueForm(f => ({ ...f, staleAlertDays: parseInt(e.target.value) || 3 }))}
                />
                <p className="text-xs text-ink-muted mt-1">
                  Omar will flag deals with no update after this many days.
                </p>
              </div>
            </div>
            <button
              onClick={saveRevenue}
              className="px-5 py-2.5 rounded-lg text-sm font-bold transition-all"
              style={{ background: revenueSaved ? "#0D2016" : "#A51C1C", color: revenueSaved ? "#4ADE80" : "#fff" }}
            >
              {revenueSaved ? "✓ Saved" : "Save Settings"}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
