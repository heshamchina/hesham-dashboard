"use client"
import { useState } from "react"
import { useStore } from "@/lib/store"
import clsx from "clsx"
import type { ProjectHealth } from "@/types"

const HEALTH_CONFIG: Record<ProjectHealth, { label: string; dot: string; accent: string }> = {
  "on-track": { label: "On Track", dot: "#4ADE80", accent: "#4ADE80" },
  "at-risk":  { label: "At Risk",  dot: "#FACC15", accent: "#FACC15" },
  "blocked":  { label: "Blocked",  dot: "#EF4444", accent: "#EF4444" },
}

const EMPTY_FORM = {
  name: "", description: "", health: "on-track" as ProjectHealth,
  progress: 0, nextAction: "", liveUrl: "", tags: "",
}

export default function ProjectsHub() {
  const { projects, addProject, updateProject, deleteProject } = useStore()
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showNew, setShowNew] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)

  function openEdit(id: string) {
    const p = projects.find(p => p.id === id)
    if (!p) return
    setForm({
      name: p.name, description: p.description, health: p.health,
      progress: p.progress, nextAction: p.nextAction,
      liveUrl: p.liveUrl || "", tags: p.tags.join(", "),
    })
    setEditingId(id)
    setExpandedId(id)
  }

  function saveEdit() {
    if (!form.name.trim() || !editingId) return
    updateProject(editingId, {
      ...form,
      tags: form.tags.split(",").map(t => t.trim()).filter(Boolean),
    })
    setEditingId(null)
  }

  function saveNew() {
    if (!form.name.trim()) return
    addProject({
      ...form,
      tags: form.tags.split(",").map(t => t.trim()).filter(Boolean),
      vercelUrl: "",
    })
    setForm(EMPTY_FORM)
    setShowNew(false)
  }

  function cancelForm() {
    setEditingId(null)
    setShowNew(false)
    setForm(EMPTY_FORM)
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-display">Projects</h2>
          <p className="text-sm text-ink-muted mt-0.5">{projects.length} active project{projects.length !== 1 ? "s" : ""}</p>
        </div>
        <button
          onClick={() => { setShowNew(!showNew); setEditingId(null); setForm(EMPTY_FORM) }}
          className="px-4 py-2 rounded-lg text-sm font-bold transition-colors"
          style={{ background: "#A51C1C", color: "#fff" }}
        >
          ＋ New Project
        </button>
      </div>

      {/* New project form */}
      {showNew && (
        <ProjectForm
          form={form}
          setForm={setForm}
          onSave={saveNew}
          onCancel={cancelForm}
          title="New Project"
        />
      )}

      {/* Project list */}
      {projects.length === 0 && !showNew ? (
        <div className="text-center py-16 text-ink-muted">
          <p className="text-4xl mb-3">🚀</p>
          <p className="text-sm font-medium text-ink-secondary">No projects yet</p>
          <p className="text-xs mt-1">Add your first project above</p>
        </div>
      ) : (
        <div className="space-y-2">
          {projects.map(p => {
            const cfg = HEALTH_CONFIG[p.health]
            const isExpanded = expandedId === p.id
            const isEditing = editingId === p.id

            return (
              <div
                key={p.id}
                className="rounded-2xl overflow-hidden transition-all"
                style={{
                  background: "#1A1A1A",
                  border: `1px solid #252525`,
                  borderLeft: `3px solid ${cfg.dot}`,
                }}
              >
                {/* Row */}
                <button
                  onClick={() => {
                    if (editingId === p.id) return
                    setExpandedId(isExpanded ? null : p.id)
                    if (editingId && editingId !== p.id) setEditingId(null)
                  }}
                  className="w-full flex items-center gap-4 px-4 py-3.5 text-left"
                >
                  {/* Health dot */}
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: cfg.dot }} />

                  {/* Name + description */}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-ink-primary text-sm">{p.name}</p>
                    {p.description && (
                      <p className="text-xs text-ink-muted truncate mt-0.5">{p.description}</p>
                    )}
                  </div>

                  {/* Progress pill */}
                  <span className="text-xs font-medium shrink-0" style={{ color: cfg.dot }}>
                    {p.progress}%
                  </span>

                  {/* Health badge */}
                  <span
                    className="text-xs px-2 py-0.5 rounded-full font-medium shrink-0"
                    style={{
                      background: `${cfg.dot}18`,
                      color: cfg.dot,
                      border: `1px solid ${cfg.dot}30`,
                    }}
                  >
                    {cfg.label}
                  </span>

                  {/* Chevron */}
                  <svg
                    width="14" height="14" viewBox="0 0 24 24" fill="none"
                    stroke="#505050" strokeWidth="2" strokeLinecap="round"
                    className={clsx("shrink-0 transition-transform duration-200", isExpanded && "rotate-180")}
                  >
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                </button>

                {/* Expanded — view or edit */}
                {isExpanded && (
                  <div className="px-4 pb-4 border-t border-surface-border">
                    {isEditing ? (
                      <div className="pt-4">
                        <ProjectForm
                          form={form}
                          setForm={setForm}
                          onSave={saveEdit}
                          onCancel={cancelForm}
                          title="Edit Project"
                          inline
                        />
                      </div>
                    ) : (
                      <div className="pt-4 space-y-3">
                        {/* Progress bar */}
                        <div>
                          <div className="flex justify-between text-xs text-ink-muted mb-1.5">
                            <span>Progress</span>
                            <span style={{ color: cfg.dot }}>{p.progress}%</span>
                          </div>
                          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "#2A2A2A" }}>
                            <div
                              className="h-full rounded-full transition-all"
                              style={{ width: `${p.progress}%`, background: cfg.dot }}
                            />
                          </div>
                          <input
                            type="range" min={0} max={100} value={p.progress}
                            onChange={e => updateProject(p.id, { progress: parseInt(e.target.value) })}
                            className="w-full mt-1 opacity-0 h-0 pointer-events-none"
                          />
                          <input
                            type="range" min={0} max={100} value={p.progress}
                            onChange={e => updateProject(p.id, { progress: parseInt(e.target.value) })}
                            className="w-full accent-brand-red mt-1 h-4 opacity-60"
                          />
                        </div>

                        {/* Next action */}
                        {p.nextAction && (
                          <div className="flex gap-2 items-start">
                            <span className="text-xs font-semibold text-ink-muted shrink-0 mt-0.5">→</span>
                            <p className="text-sm text-ink-secondary">{p.nextAction}</p>
                          </div>
                        )}

                        {/* Tags */}
                        {p.tags.length > 0 && (
                          <div className="flex gap-1 flex-wrap">
                            {p.tags.map(t => (
                              <span key={t} className="text-xs px-2 py-0.5 rounded-full"
                                style={{ background: "#242424", color: "#808080", border: "1px solid #2E2E2E" }}>
                                {t}
                              </span>
                            ))}
                          </div>
                        )}

                        {/* Actions */}
                        <div className="flex items-center gap-2 pt-1">
                          {p.liveUrl && (
                            <a href={p.liveUrl} target="_blank" rel="noopener"
                              className="text-xs font-medium transition-colors"
                              style={{ color: "#A51C1C" }}>
                              ↗ Open
                            </a>
                          )}
                          <div className="ml-auto flex gap-2">
                            <button onClick={() => openEdit(p.id)}
                              className="text-xs px-3 py-1.5 rounded-lg transition-colors"
                              style={{ background: "#242424", color: "#A0A0A0", border: "1px solid #2E2E2E" }}>
                              ✎ Edit
                            </button>
                            <button
                              onClick={() => { if (confirm(`Delete "${p.name}"?`)) deleteProject(p.id) }}
                              className="text-xs px-3 py-1.5 rounded-lg transition-colors hover:bg-red-900"
                              style={{ background: "#242424", color: "#808080", border: "1px solid #2E2E2E" }}>
                              ✕
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Shared form component ───────────────────────────────────────
function ProjectForm({
  form,
  setForm,
  onSave,
  onCancel,
  title,
  inline = false,
}: {
  form: typeof EMPTY_FORM
  setForm: React.Dispatch<React.SetStateAction<typeof EMPTY_FORM>>
  onSave: () => void
  onCancel: () => void
  title: string
  inline?: boolean
}) {
  return (
    <div
      className={clsx("space-y-3", !inline && "rounded-2xl p-5")}
      style={!inline ? { background: "#1A1A1A", border: "1px solid #252525" } : {}}
    >
      {!inline && (
        <p className="font-semibold text-ink-primary text-sm">{title}</p>
      )}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Name</label>
          <input className="input" placeholder="Project name" value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
        </div>
        <div>
          <label className="label">Health</label>
          <select className="input" value={form.health}
            onChange={e => setForm(f => ({ ...f, health: e.target.value as ProjectHealth }))}>
            <option value="on-track">✅ On Track</option>
            <option value="at-risk">⚠️ At Risk</option>
            <option value="blocked">🔴 Blocked</option>
          </select>
        </div>
        <div className="col-span-2">
          <label className="label">Description</label>
          <input className="input" placeholder="What is this project?" value={form.description}
            onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
        </div>
        <div className="col-span-2">
          <label className="label">Next Action</label>
          <input className="input" placeholder="What needs to happen next?" value={form.nextAction}
            onChange={e => setForm(f => ({ ...f, nextAction: e.target.value }))} />
        </div>
        <div>
          <label className="label">Progress ({form.progress}%)</label>
          <input type="range" min={0} max={100} value={form.progress}
            onChange={e => setForm(f => ({ ...f, progress: parseInt(e.target.value) }))}
            className="w-full accent-brand-red mt-2" />
        </div>
        <div>
          <label className="label">Live URL</label>
          <input className="input" placeholder="https://..." value={form.liveUrl}
            onChange={e => setForm(f => ({ ...f, liveUrl: e.target.value }))} />
        </div>
        <div className="col-span-2">
          <label className="label">Tags (comma separated)</label>
          <input className="input" placeholder="tech, SaaS, content" value={form.tags}
            onChange={e => setForm(f => ({ ...f, tags: e.target.value }))} />
        </div>
      </div>
      <div className="flex gap-2 pt-1">
        <button onClick={onSave}
          className="px-4 py-2 rounded-lg text-sm font-bold transition-colors"
          style={{ background: "#A51C1C", color: "#fff" }}>
          Save
        </button>
        <button onClick={onCancel}
          className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          style={{ background: "#242424", color: "#A0A0A0", border: "1px solid #2E2E2E" }}>
          Cancel
        </button>
      </div>
    </div>
  )
}
