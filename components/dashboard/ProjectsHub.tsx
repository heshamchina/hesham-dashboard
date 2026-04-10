"use client"
import { useState, useEffect } from "react"
import { useStore } from "@/lib/store"
import clsx from "clsx"
import type { ProjectHealth } from "@/types"

const HEALTH_COLORS: Record<ProjectHealth, string> = {
  "on-track": "bg-green-100 text-green-700 border-green-200",
  "at-risk":  "bg-yellow-100 text-yellow-700 border-yellow-200",
  "blocked":  "bg-red-100 text-red-700 border-red-200",
}

const HEALTH_DOT: Record<ProjectHealth, string> = {
  "on-track": "bg-green-400",
  "at-risk":  "bg-yellow-400",
  "blocked":  "bg-red-400",
}

export default function ProjectsHub() {
  const { projects, addProject, updateProject, deleteProject } = useStore()
  const [vercelProjects, setVercelProjects] = useState<any[]>([])
  const [vercelLoading, setVercelLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState({ name: "", description: "", health: "on-track" as ProjectHealth, progress: 0, nextAction: "", liveUrl: "", tags: "" })

  useEffect(() => {
    setVercelLoading(true)
    fetch("/api/vercel-projects")
      .then(r => r.json())
      .then(d => setVercelProjects(d.projects || []))
      .catch(() => {})
      .finally(() => setVercelLoading(false))
  }, [])

  function handleSave() {
    if (!form.name) return
    const data = { ...form, tags: form.tags.split(",").map(t => t.trim()).filter(Boolean), vercelUrl: "", liveUrl: form.liveUrl }
    if (editId) {
      updateProject(editId, data)
      setEditId(null)
    } else {
      addProject(data)
    }
    setForm({ name: "", description: "", health: "on-track", progress: 0, nextAction: "", liveUrl: "", tags: "" })
    setShowForm(false)
  }

  function startEdit(id: string) {
    const p = projects.find(p => p.id === id)
    if (!p) return
    setForm({ name: p.name, description: p.description, health: p.health, progress: p.progress, nextAction: p.nextAction, liveUrl: p.liveUrl || "", tags: p.tags.join(", ") })
    setEditId(id)
    setShowForm(true)
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">🚀 Projects Hub</h1>
        <button onClick={() => { setShowForm(!showForm); setEditId(null) }} className="btn-primary">＋ Add Project</button>
      </div>

      {/* Add/Edit form */}
      {showForm && (
        <div className="card p-4">
          <h3 className="font-semibold text-gray-800 mb-3">{editId ? "Edit Project" : "New Project"}</h3>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div><label className="label">Name</label><input className="input" placeholder="Project name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
            <div><label className="label">Health</label>
              <select className="input" value={form.health} onChange={e => setForm(f => ({ ...f, health: e.target.value as ProjectHealth }))}>
                <option value="on-track">✅ On Track</option>
                <option value="at-risk">⚠️ At Risk</option>
                <option value="blocked">🔴 Blocked</option>
              </select>
            </div>
            <div className="col-span-2"><label className="label">Description</label><input className="input" placeholder="What is this project?" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} /></div>
            <div className="col-span-2"><label className="label">Next Action</label><input className="input" placeholder="What needs to happen next?" value={form.nextAction} onChange={e => setForm(f => ({ ...f, nextAction: e.target.value }))} /></div>
            <div>
              <label className="label">Progress ({form.progress}%)</label>
              <input type="range" min={0} max={100} value={form.progress} onChange={e => setForm(f => ({ ...f, progress: parseInt(e.target.value) }))} className="w-full accent-brand-gold" />
            </div>
            <div><label className="label">Live URL</label><input className="input" placeholder="https://..." value={form.liveUrl} onChange={e => setForm(f => ({ ...f, liveUrl: e.target.value }))} /></div>
            <div className="col-span-2"><label className="label">Tags (comma separated)</label><input className="input" placeholder="tech, SaaS, content" value={form.tags} onChange={e => setForm(f => ({ ...f, tags: e.target.value }))} /></div>
          </div>
          <div className="flex gap-2">
            <button onClick={handleSave} className="btn-primary">Save</button>
            <button onClick={() => { setShowForm(false); setEditId(null) }} className="btn-secondary">Cancel</button>
          </div>
        </div>
      )}

      {/* My Projects */}
      <div>
        <p className="section-title">My Projects ({projects.length})</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {projects.map(p => (
            <div key={p.id} className={clsx("card p-4 border-l-4", p.health === "on-track" ? "border-l-green-400" : p.health === "at-risk" ? "border-l-yellow-400" : "border-l-red-400")}>
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h3 className="font-semibold text-gray-900">{p.name}</h3>
                  <p className="text-xs text-gray-500 mt-0.5">{p.description}</p>
                </div>
                <span className={clsx("text-xs px-2 py-0.5 rounded-full border font-medium shrink-0 ml-2", HEALTH_COLORS[p.health])}>
                  {p.health === "on-track" ? "On Track" : p.health === "at-risk" ? "At Risk" : "Blocked"}
                </span>
              </div>

              {/* Progress */}
              <div className="mb-2">
                <div className="flex justify-between text-xs text-gray-400 mb-1">
                  <span>Progress</span><span>{p.progress}%</span>
                </div>
                <input type="range" min={0} max={100} value={p.progress}
                  onChange={e => updateProject(p.id, { progress: parseInt(e.target.value) })}
                  className="w-full accent-brand-gold h-1.5" />
              </div>

              <p className="text-xs text-gray-600 mb-2">→ {p.nextAction}</p>

              {/* Tags */}
              {p.tags.length > 0 && (
                <div className="flex gap-1 flex-wrap mb-2">
                  {p.tags.map(t => <span key={t} className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{t}</span>)}
                </div>
              )}

              <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
                {p.liveUrl && <a href={p.liveUrl} target="_blank" rel="noopener" className="text-xs text-brand-red hover:underline font-medium">↗ Open</a>}
                <div className="ml-auto flex gap-2">
                  <button onClick={() => startEdit(p.id)} className="text-xs text-gray-400 hover:text-brand-red">✎ Edit</button>
                  <button onClick={() => { if (confirm(`Delete ${p.name}?`)) deleteProject(p.id) }} className="text-xs text-gray-300 hover:text-red-400">✕</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Vercel Deployments */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="section-title mb-0">Vercel Deployments</p>
          {vercelLoading && <span className="text-xs text-gray-400">Loading...</span>}
        </div>

        {!process.env.NEXT_PUBLIC_HAS_VERCEL && vercelProjects.length === 0 && !vercelLoading && (
          <div className="card p-4 text-center text-gray-400 text-sm">
            <p>Add <code className="bg-gray-100 px-1 rounded">VERCEL_TOKEN</code> to .env.local to see your deployments</p>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {vercelProjects.map(vp => (
            <a key={vp.id} href={vp.url} target="_blank" rel="noopener"
              className="card p-3 flex items-center gap-3 hover:border-brand-red/30 transition-colors group">
              <div className={clsx("w-2.5 h-2.5 rounded-full shrink-0",
                vp.latestDeployment === "READY" ? "bg-green-400" :
                vp.latestDeployment === "ERROR" ? "bg-red-400" : "bg-gray-300"
              )} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{vp.name}</p>
                <p className="text-xs text-gray-400 truncate">{vp.url}</p>
              </div>
              <span className="text-brand-red text-sm group-hover:translate-x-0.5 transition-transform">↗</span>
            </a>
          ))}
        </div>
      </div>
    </div>
  )
}
