"use client"
import { useState } from "react"
import { useStore } from "@/lib/store"
import clsx from "clsx"
import type { Contact, ContactType } from "@/types"

const TYPE_CONFIG: Record<ContactType, { label: string; color: string; emoji: string }> = {
  client:       { label: "Client",       color: "bg-blue-100 text-blue-700",   emoji: "💼" },
  supplier:     { label: "Supplier",     color: "bg-orange-100 text-orange-700", emoji: "🏭" },
  collaborator: { label: "Collab",       color: "bg-purple-100 text-purple-700", emoji: "🤝" },
  lead:         { label: "Lead",         color: "bg-yellow-100 text-yellow-700", emoji: "⭐" },
  other:        { label: "Other",        color: "bg-gray-100 text-gray-600",    emoji: "👤" },
}

const COUNTRIES = ["China", "Jordan", "UAE", "Saudi Arabia", "Egypt", "USA", "UK", "Other"]

export default function ContactsCRM() {
  const { contacts, deals, addContact, updateContact, deleteContact, addContactNote } = useStore()
  const [search, setSearch] = useState("")
  const [filterType, setFilterType] = useState<ContactType | "all">("all")
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [noteText, setNoteText] = useState("")
  const [form, setForm] = useState<Omit<Contact, "id" | "createdAt" | "notes">>({
    name: "", type: "client", company: "", wechat: "", whatsapp: "", email: "", country: "China", tags: []
  })
  const [tagInput, setTagInput] = useState("")

  const filtered = contacts.filter(c => {
    const matchSearch = c.name.toLowerCase().includes(search.toLowerCase()) ||
      (c.company || "").toLowerCase().includes(search.toLowerCase())
    const matchType = filterType === "all" || c.type === filterType
    return matchSearch && matchType
  })

  const selected = contacts.find(c => c.id === selectedId)

  function handleAdd() {
    if (!form.name.trim()) return
    addContact(form)
    setForm({ name: "", type: "client", company: "", wechat: "", whatsapp: "", email: "", country: "China", tags: [] })
    setTagInput("")
    setShowForm(false)
  }

  function addTag() {
    if (!tagInput.trim()) return
    setForm(f => ({ ...f, tags: [...f.tags, tagInput.trim()] }))
    setTagInput("")
  }

  function daysSince(iso?: string) {
    if (!iso) return null
    return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Contacts</h2>
          <p className="text-sm text-gray-400">{contacts.length} people in your network</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="btn-primary">
          + Add Contact
        </button>
      </div>

      {/* Add Form */}
      {showForm && (
        <div className="card p-4 border-l-4 border-brand-red">
          <h3 className="font-semibold text-gray-800 mb-3">New Contact</h3>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="label">Name *</label>
              <input className="input" placeholder="Ahmed Al-Rashid" value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div>
              <label className="label">Type</label>
              <select className="input" value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value as ContactType }))}>
                {Object.entries(TYPE_CONFIG).map(([k, v]) => (
                  <option key={k} value={k}>{v.emoji} {v.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Company</label>
              <input className="input" placeholder="Company name" value={form.company || ""}
                onChange={e => setForm(f => ({ ...f, company: e.target.value }))} />
            </div>
            <div>
              <label className="label">Country</label>
              <select className="input" value={form.country || "China"} onChange={e => setForm(f => ({ ...f, country: e.target.value }))}>
                {COUNTRIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="label">WeChat</label>
              <input className="input" placeholder="wechat_id" value={form.wechat || ""}
                onChange={e => setForm(f => ({ ...f, wechat: e.target.value }))} />
            </div>
            <div>
              <label className="label">WhatsApp</label>
              <input className="input" placeholder="+962..." value={form.whatsapp || ""}
                onChange={e => setForm(f => ({ ...f, whatsapp: e.target.value }))} />
            </div>
            <div className="col-span-2">
              <label className="label">Email</label>
              <input className="input" placeholder="email@domain.com" value={form.email || ""}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
            </div>
            <div className="col-span-2">
              <label className="label">Tags</label>
              <div className="flex gap-2">
                <input className="input flex-1" placeholder="e.g. vip, canton-fair" value={tagInput}
                  onChange={e => setTagInput(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && addTag()} />
                <button onClick={addTag} className="btn-secondary px-3">+</button>
              </div>
              {form.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {form.tags.map(t => (
                    <span key={t} className="bg-gray-100 text-gray-600 text-xs px-2 py-0.5 rounded-full flex items-center gap-1">
                      {t}
                      <button onClick={() => setForm(f => ({ ...f, tags: f.tags.filter(x => x !== t) }))} className="hover:text-red-500">×</button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={handleAdd} className="btn-primary">Save Contact</button>
            <button onClick={() => setShowForm(false)} className="btn-secondary">Cancel</button>
          </div>
        </div>
      )}

      {/* Search + Filter */}
      <div className="flex gap-2 flex-wrap">
        <input className="input flex-1 min-w-48" placeholder="Search by name or company..."
          value={search} onChange={e => setSearch(e.target.value)} />
        <div className="flex gap-1">
          {(["all", "client", "supplier", "collaborator", "lead", "other"] as const).map(t => (
            <button key={t} onClick={() => setFilterType(t)}
              className={clsx("px-3 py-2 rounded-lg text-xs font-medium transition-colors border",
                filterType === t
                  ? "bg-brand-red text-white border-brand-red"
                  : "bg-white text-gray-500 border-gray-200 hover:border-brand-red hover:text-brand-red"
              )}>
              {t === "all" ? "All" : TYPE_CONFIG[t].emoji + " " + TYPE_CONFIG[t].label}
            </button>
          ))}
        </div>
      </div>

      {/* Two-panel layout */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Contact list */}
        <div className="lg:col-span-2 space-y-2">
          {filtered.length === 0 && (
            <div className="card p-8 text-center text-gray-400">
              <p className="text-3xl mb-2">👥</p>
              <p className="font-medium text-sm">No contacts yet</p>
              <p className="text-xs mt-1">Add suppliers, clients, collabs</p>
            </div>
          )}
          {filtered.map(c => {
            const cfg = TYPE_CONFIG[c.type]
            const days = daysSince(c.lastContactedAt)
            return (
              <button key={c.id} onClick={() => setSelectedId(c.id === selectedId ? null : c.id)}
                className={clsx("card p-3 w-full text-left transition-all hover:shadow-md",
                  selectedId === c.id ? "border-brand-red ring-1 ring-brand-red/20" : ""
                )}>
                <div className="flex items-center gap-3">
                  <div className={clsx("w-9 h-9 rounded-full flex items-center justify-center text-lg shrink-0", cfg.color.split(" ")[0])}>
                    {cfg.emoji}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-sm text-gray-900 truncate">{c.name}</p>
                      <span className={clsx("text-xs px-1.5 py-0.5 rounded-full font-medium shrink-0", cfg.color)}>{cfg.label}</span>
                    </div>
                    {c.company && <p className="text-xs text-gray-400 truncate">{c.company}</p>}
                    <div className="flex items-center gap-2 mt-0.5">
                      {c.country && <span className="text-xs text-gray-400">{c.country}</span>}
                      {days !== null && (
                        <span className={clsx("text-xs", days > 30 ? "text-red-400" : days > 14 ? "text-yellow-500" : "text-green-500")}>
                          · {days === 0 ? "today" : `${days}d ago`}
                        </span>
                      )}
                    </div>
                  </div>
                  {c.notes.length > 0 && <span className="text-xs text-gray-300">📝{c.notes.length}</span>}
                </div>
              </button>
            )
          })}
        </div>

        {/* Detail panel */}
        {selected ? (
          <div className="lg:col-span-3 card p-4 space-y-4 h-fit">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className={clsx("w-12 h-12 rounded-full flex items-center justify-center text-2xl", TYPE_CONFIG[selected.type].color.split(" ")[0])}>
                  {TYPE_CONFIG[selected.type].emoji}
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 text-lg">{selected.name}</h3>
                  {selected.company && <p className="text-sm text-gray-500">{selected.company}</p>}
                  <span className={clsx("text-xs px-2 py-0.5 rounded-full font-medium", TYPE_CONFIG[selected.type].color)}>
                    {TYPE_CONFIG[selected.type].label}
                  </span>
                </div>
              </div>
              <button onClick={() => deleteContact(selected.id)}
                className="text-gray-300 hover:text-red-400 text-sm transition-colors">✕</button>
            </div>

            {/* Contact info */}
            <div className="grid grid-cols-2 gap-2 text-sm">
              {selected.wechat && (
                <div className="flex items-center gap-2 bg-green-50 rounded-lg px-3 py-2">
                  <span>💬</span>
                  <div>
                    <p className="text-xs text-gray-400">WeChat</p>
                    <p className="font-medium text-gray-700">{selected.wechat}</p>
                  </div>
                </div>
              )}
              {selected.whatsapp && (
                <div className="flex items-center gap-2 bg-green-50 rounded-lg px-3 py-2">
                  <span>📱</span>
                  <div>
                    <p className="text-xs text-gray-400">WhatsApp</p>
                    <p className="font-medium text-gray-700">{selected.whatsapp}</p>
                  </div>
                </div>
              )}
              {selected.email && (
                <div className="flex items-center gap-2 bg-blue-50 rounded-lg px-3 py-2 col-span-2">
                  <span>✉️</span>
                  <div>
                    <p className="text-xs text-gray-400">Email</p>
                    <p className="font-medium text-gray-700">{selected.email}</p>
                  </div>
                </div>
              )}
              {selected.country && (
                <div className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2">
                  <span>🌍</span>
                  <div>
                    <p className="text-xs text-gray-400">Country</p>
                    <p className="font-medium text-gray-700">{selected.country}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Tags */}
            {selected.tags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {selected.tags.map(t => (
                  <span key={t} className="bg-brand-cream text-brand-red text-xs px-2 py-0.5 rounded-full font-medium">{t}</span>
                ))}
              </div>
            )}

            {/* Linked deals */}
            {(() => {
              const linkedDeals = deals.filter(d => d.contactId === selected.id)
              if (!linkedDeals.length) return null
              return (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Linked Deals</p>
                  <div className="space-y-1">
                    {linkedDeals.map(d => (
                      <div key={d.id} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2 text-sm">
                        <span className="font-medium">{d.client}</span>
                        <span className="text-brand-red font-bold">${d.value.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })()}

            {/* Notes */}
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Notes & Activity</p>
              <div className="space-y-2 max-h-48 overflow-y-auto mb-3">
                {selected.notes.length === 0 && <p className="text-xs text-gray-300 italic">No notes yet</p>}
                {[...selected.notes].reverse().map(n => (
                  <div key={n.id} className="text-sm bg-gray-50 rounded-lg px-3 py-2">
                    <p className="text-xs text-gray-400 mb-0.5">{new Date(n.date).toLocaleDateString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</p>
                    <p className="text-gray-700">{n.text}</p>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <input className="input flex-1 text-sm" placeholder="Add note or interaction..."
                  value={noteText}
                  onChange={e => setNoteText(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === "Enter" && noteText.trim()) {
                      addContactNote(selected.id, noteText.trim())
                      setNoteText("")
                    }
                  }} />
                <button onClick={() => { if (noteText.trim()) { addContactNote(selected.id, noteText.trim()); setNoteText("") } }}
                  className="btn-primary px-3">+</button>
              </div>
            </div>
          </div>
        ) : (
          <div className="lg:col-span-3 card p-8 text-center text-gray-300 h-fit">
            <p className="text-4xl mb-2">👤</p>
            <p className="text-sm">Select a contact to view details</p>
          </div>
        )}
      </div>
    </div>
  )
}
