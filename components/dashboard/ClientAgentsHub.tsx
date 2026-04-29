"use client"
import { useEffect, useMemo, useRef, useState } from "react"
import clsx from "clsx"
import { useStore } from "@/lib/store"
import { db } from "@/lib/db"
import type { ClientRecord, ClientStatus } from "@/types"
import { AGENTS, type AgentId } from "@/lib/agents"

const STATUS_OPTIONS: Array<{ value: ClientStatus; label: string; tone: string }> = [
  { value: "active", label: "Active", tone: "badge-green" },
  { value: "pending", label: "Pending", tone: "badge-yellow" },
  { value: "closed", label: "Closed", tone: "badge-muted" },
]

const AUTHOR_OPTIONS: Array<{ value: "me" | "agent"; label: string }> = [
  { value: "me", label: "Me" },
  { value: "agent", label: "Agent" },
]

const SORT_OPTIONS = [
  { value: "updated-desc", label: "Last updated (newest)" },
  { value: "updated-asc", label: "Last updated (oldest)" },
  { value: "name-asc", label: "Name (A-Z)" },
  { value: "status", label: "Status" },
] as const

type SortValue = typeof SORT_OPTIONS[number]["value"]

type ChatMessage = {
  role: "user" | "assistant"
  content: string
}

type ClientDraft = Omit<ClientRecord, "id" | "discussion" | "createdAt" | "updatedAt"> & {
  productsText: string
}

const EMPTY_DRAFT: ClientDraft = {
  name: "",
  contactInfo: "",
  whatsapp: "",
  industry: "",
  productsWanted: [],
  productsText: "",
  productPhotos: [],
  managerName: "",
  managerField: "",
  status: "pending",
}

function normalizeWhatsapp(input: string) {
  return input.replace(/[^\d]/g, "")
}

export default function ClientAgentsHub() {
  const {
    clientRecords,
    addClientRecord,
    updateClientRecord,
    deleteClientRecord,
    addClientDiscussion,
    addClientProductPhoto,
    removeClientProductPhoto,
  } = useStore()

  const [showForm, setShowForm] = useState(false)
  const [draft, setDraft] = useState<ClientDraft>(EMPTY_DRAFT)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<ClientStatus | "all">("all")
  const [discussionText, setDiscussionText] = useState("")
  const [discussionAuthor, setDiscussionAuthor] = useState<"me" | "agent">("me")
  const [sortBy, setSortBy] = useState<SortValue>("updated-desc")
  const [formError, setFormError] = useState("")
  const [uploadingPhotos, setUploadingPhotos] = useState(false)
  const [activeAgentId, setActiveAgentId] = useState<AgentId>("omar")
  const [agentInput, setAgentInput] = useState("")
  const [agentLoading, setAgentLoading] = useState(false)
  const [agentMessages, setAgentMessages] = useState<ChatMessage[]>([])
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const activeAgent = AGENTS.find(a => a.id === activeAgentId) || AGENTS[0]

  useEffect(() => {
    setAgentMessages([])
    setAgentInput("")
  }, [selectedId, activeAgentId])

  const selected = useMemo(
    () => clientRecords.find(c => c.id === selectedId) ?? null,
    [clientRecords, selectedId]
  )

  const visibleClients = useMemo(() => {
    const filtered = clientRecords.filter(c => {
      const matchesStatus = statusFilter === "all" || c.status === statusFilter
      const needle = search.toLowerCase().trim()
      if (!needle) return matchesStatus
      const hay = [
        c.name,
        c.contactInfo,
        c.industry,
        c.managerName,
        c.managerField,
        ...c.productsWanted,
      ].join(" ").toLowerCase()
      return matchesStatus && hay.includes(needle)
    })

    if (sortBy === "name-asc") {
      return [...filtered].sort((a, b) => a.name.localeCompare(b.name))
    }
    if (sortBy === "status") {
      const rank: Record<ClientStatus, number> = { active: 0, pending: 1, closed: 2 }
      return [...filtered].sort((a, b) => rank[a.status] - rank[b.status])
    }
    if (sortBy === "updated-asc") {
      return [...filtered].sort((a, b) => new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime())
    }
    return [...filtered].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
  }, [clientRecords, search, statusFilter, sortBy])

  const stats = useMemo(() => ({
    total: clientRecords.length,
    active: clientRecords.filter(c => c.status === "active").length,
    pending: clientRecords.filter(c => c.status === "pending").length,
    photos: clientRecords.reduce((sum, c) => sum + c.productPhotos.length, 0),
  }), [clientRecords])

  function resetDraft() {
    setDraft(EMPTY_DRAFT)
    setFormError("")
  }

  function createClient() {
    setFormError("")
    const productsWanted = draft.productsText
      .split(",")
      .map(p => p.trim())
      .filter(Boolean)

    const dedupedProducts = [...new Set(productsWanted.map(p => p.toLowerCase()))]
      .map(lower => productsWanted.find(p => p.toLowerCase() === lower) || lower)

    if (!draft.name.trim() || !draft.contactInfo.trim() || !draft.managerName.trim() || !draft.managerField.trim() || !draft.industry.trim()) {
      setFormError("Please fill all required fields including industry.")
      return
    }

    const whatsappDigits = normalizeWhatsapp(draft.whatsapp || "")
    if (draft.whatsapp?.trim() && whatsappDigits.length < 8) {
      setFormError("WhatsApp number looks too short.")
      return
    }

    const duplicate = clientRecords.find(c =>
      c.name.toLowerCase().trim() === draft.name.toLowerCase().trim() &&
      c.contactInfo.toLowerCase().trim() === draft.contactInfo.toLowerCase().trim()
    )
    if (duplicate) {
      setFormError("This client already exists in your desk.")
      return
    }

    addClientRecord({
      name: draft.name.trim(),
      contactInfo: draft.contactInfo.trim(),
      whatsapp: whatsappDigits || undefined,
      industry: draft.industry.trim(),
      productsWanted: dedupedProducts,
      productPhotos: draft.productPhotos,
      managerName: draft.managerName.trim(),
      managerField: draft.managerField.trim(),
      status: draft.status,
    })

    resetDraft()
    setShowForm(false)
  }

  async function onUploadPhotos(clientId: string, files: FileList | null) {
    if (!files?.length) return
    setUploadingPhotos(true)
    for (const file of Array.from(files)) {
      try {
        const url = await db.clientRecords.uploadProductPhoto(file, clientId)
        if (url) addClientProductPhoto(clientId, url)
      } catch {
        // Fallback to base64 for offline/failed uploads.
        const reader = new FileReader()
        reader.onload = () => {
          const data = typeof reader.result === "string" ? reader.result : ""
          if (data) addClientProductPhoto(clientId, data)
        }
        reader.readAsDataURL(file)
      }
    }
    setUploadingPhotos(false)
  }

  function submitDiscussion() {
    if (!selected || !discussionText.trim()) return
    addClientDiscussion(selected.id, {
      author: discussionAuthor,
      text: discussionText.trim(),
    })
    setDiscussionText("")
  }

  function whatsappLink(client: ClientRecord) {
    const number = normalizeWhatsapp(client.whatsapp || "")
    const defaultText = encodeURIComponent(
      `Hi ${client.name}, this is regarding ${client.productsWanted[0] || "your requested products"}.`
    )
    return number ? `https://wa.me/${number}?text=${defaultText}` : null
  }

  async function sendAgentMessage() {
    if (!selected || !agentInput.trim() || agentLoading) return
    const userText = agentInput.trim()
    setAgentInput("")
    setAgentMessages(m => [...m, { role: "user", content: userText }])
    setAgentLoading(true)

    addClientDiscussion(selected.id, { author: "me", text: `[AI:${activeAgent.name}] ${userText}` })

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId: activeAgent.id,
          memoryContext: { type: "client", id: selected.id, label: selected.name },
          clientContext: {
            id: selected.id,
            name: selected.name,
            contactInfo: selected.contactInfo,
            industry: selected.industry,
            productsWanted: selected.productsWanted,
            managerName: selected.managerName,
            managerField: selected.managerField,
            status: selected.status,
          },
          context: {
            deals: useStore.getState().deals,
            projects: useStore.getState().projects,
            followerLog: useStore.getState().followerLog,
            streaks: useStore.getState().streaks,
            weeklyGoals: useStore.getState().weeklyGoals,
          },
          messages: [{ role: "user", content: userText }],
        }),
      })
      const json = await res.json()
      const reply = json.reply || "No response"
      setAgentMessages(m => [...m, { role: "assistant", content: reply }])
      addClientDiscussion(selected.id, { author: "agent", text: `[${activeAgent.name}] ${reply}` })
    } catch {
      const fallback = "Agent unavailable right now."
      setAgentMessages(m => [...m, { role: "assistant", content: fallback }])
    } finally {
      setAgentLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h3 className="text-title">Client Agent Desk</h3>
          <p className="text-caption">Track each client, assigned agent, product demand, and discussion history.</p>
        </div>
        <button className="btn-primary" onClick={() => setShowForm(v => !v)}>
          + New Client
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        <div className="card p-3">
          <p className="text-2xs">Total clients</p>
          <p className="text-heading mt-1">{stats.total}</p>
        </div>
        <div className="card p-3">
          <p className="text-2xs">Active</p>
          <p className="text-heading mt-1 text-status-green-text">{stats.active}</p>
        </div>
        <div className="card p-3">
          <p className="text-2xs">Pending</p>
          <p className="text-heading mt-1 text-status-yellow-text">{stats.pending}</p>
        </div>
        <div className="card p-3">
          <p className="text-2xs">Product photos</p>
          <p className="text-heading mt-1">{stats.photos}</p>
        </div>
      </div>

      {showForm && (
        <div className="card p-4 space-y-3">
          <p className="section-title">Add Client + Responsible Agent</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="label">Client Name *</label>
              <input
                className="input"
                value={draft.name}
                onChange={e => setDraft(s => ({ ...s, name: e.target.value }))}
                placeholder="Client full name"
              />
            </div>
            <div>
              <label className="label">Contact Info *</label>
              <input
                className="input"
                value={draft.contactInfo}
                onChange={e => setDraft(s => ({ ...s, contactInfo: e.target.value }))}
                placeholder="Phone, email, WeChat, company"
              />
            </div>
            <div>
              <label className="label">WhatsApp Number</label>
              <input
                className="input"
                value={draft.whatsapp || ""}
                onChange={e => setDraft(s => ({ ...s, whatsapp: e.target.value }))}
                placeholder="e.g. +96279xxxxxxx"
              />
            </div>
            <div>
              <label className="label">Field / Industry *</label>
              <input
                className="input"
                value={draft.industry}
                onChange={e => setDraft(s => ({ ...s, industry: e.target.value }))}
                placeholder="Furniture, electronics, cosmetics"
              />
            </div>
            <div>
              <label className="label">Responsible Agent Name *</label>
              <input
                className="input"
                value={draft.managerName}
                onChange={e => setDraft(s => ({ ...s, managerName: e.target.value }))}
                placeholder="Assigned account manager"
              />
            </div>
            <div>
              <label className="label">Responsible Agent Field *</label>
              <input
                className="input"
                value={draft.managerField}
                onChange={e => setDraft(s => ({ ...s, managerField: e.target.value }))}
                placeholder="Sales, sourcing, logistics"
              />
            </div>
            <div className="md:col-span-2">
              <label className="label">Products They Want (comma separated)</label>
              <input
                className="input"
                value={draft.productsText}
                onChange={e => setDraft(s => ({ ...s, productsText: e.target.value }))}
                placeholder="Kitchen set, led mirror, packaging boxes"
              />
            </div>
            <div>
              <label className="label">Status</label>
              <select
                className="input"
                value={draft.status}
                onChange={e => setDraft(s => ({ ...s, status: e.target.value as ClientStatus }))}
              >
                {STATUS_OPTIONS.map(s => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
          </div>
          {formError && <p className="text-xs text-status-red-text">{formError}</p>}
          <div className="flex gap-2">
            <button className="btn-primary" onClick={createClient}>Save Client</button>
            <button className="btn-secondary" onClick={() => { resetDraft(); setShowForm(false) }}>Cancel</button>
          </div>
        </div>
      )}

      <div className="card p-3 space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <input
            className="input flex-1 min-w-[220px]"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by client, agent, field, or product"
          />
          <select
            className="input w-auto"
            value={sortBy}
            onChange={e => setSortBy(e.target.value as SortValue)}
          >
            {SORT_OPTIONS.map(s => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
          <select
            className="input w-auto"
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value as ClientStatus | "all")}
          >
            <option value="all">All statuses</option>
            {STATUS_OPTIONS.map(s => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>

        <div className="overflow-x-auto">
          <table>
            <thead>
              <tr className="text-left border-b border-surface-border">
                <th className="py-2">Name + Contact</th>
                <th className="py-2">Field</th>
                <th className="py-2">Products</th>
                <th className="py-2">Agent</th>
                <th className="py-2">Status</th>
                <th className="py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {visibleClients.map(client => {
                const statusMeta = STATUS_OPTIONS.find(s => s.value === client.status) || STATUS_OPTIONS[0]
                const active = selectedId === client.id
                const waLink = whatsappLink(client)
                return (
                  <tr
                    key={client.id}
                    className={clsx(
                      "border-b border-surface-border/60 cursor-pointer transition-colors",
                      active ? "bg-white/5" : "hover:bg-white/[0.03]"
                    )}
                    onClick={() => setSelectedId(client.id)}
                  >
                    <td className="py-2 pr-2 align-top">
                      <p className="text-sm font-semibold text-ink-primary">{client.name}</p>
                      <p className="text-xs text-ink-muted mt-0.5">{client.contactInfo}</p>
                    </td>
                    <td className="py-2 pr-2 align-top text-sm text-ink-secondary">{client.industry || "-"}</td>
                    <td className="py-2 pr-2 align-top text-sm text-ink-secondary">
                      {client.productsWanted.length ? client.productsWanted.slice(0, 2).join(", ") : "-"}
                      {client.productsWanted.length > 2 ? ` +${client.productsWanted.length - 2}` : ""}
                    </td>
                    <td className="py-2 pr-2 align-top">
                      <p className="text-sm text-ink-primary">{client.managerName}</p>
                      <p className="text-xs text-ink-muted">{client.managerField}</p>
                    </td>
                    <td className="py-2 align-top">
                      <span className={clsx("badge", statusMeta.tone)}>{statusMeta.label}</span>
                    </td>
                    <td className="py-2 align-top">
                      <div className="flex items-center gap-2">
                        {waLink && (
                          <a
                            href={waLink}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs text-brand-gold hover:text-brand-gold-light"
                            onClick={e => e.stopPropagation()}
                          >
                            WhatsApp
                          </a>
                        )}
                        <button
                          className="text-xs text-ink-muted hover:text-ink-primary"
                          onClick={e => {
                            e.stopPropagation()
                            setSelectedId(client.id)
                          }}
                        >
                          Open
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {visibleClients.length === 0 && (
            <div className="text-center text-caption py-8">No clients yet. Create your first client record.</div>
          )}
        </div>
      </div>

      {selected && (
        <div className="card p-4 space-y-4 animate-fade-in">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <h4 className="text-heading">{selected.name}</h4>
              <p className="text-caption">Assigned: {selected.managerName} ({selected.managerField})</p>
            </div>
            <div className="flex items-center gap-2">
              <select
                className="input w-auto"
                value={selected.status}
                onChange={e => updateClientRecord(selected.id, { status: e.target.value as ClientStatus })}
              >
                {STATUS_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
              <button className="btn-secondary" onClick={() => deleteClientRecord(selected.id)}>Delete</button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="space-y-3">
              <div>
                <p className="section-title">Products Wanted</p>
                <div className="flex flex-wrap gap-1.5">
                  {selected.productsWanted.length === 0 && <span className="text-caption">No products listed.</span>}
                  {selected.productsWanted.map((item, idx) => (
                    <span key={`${item}-${idx}`} className="badge badge-blue">{item}</span>
                  ))}
                </div>
              </div>

              <div>
                <p className="section-title">WhatsApp</p>
                {whatsappLink(selected) ? (
                  <a href={whatsappLink(selected) || "#"} target="_blank" rel="noreferrer" className="btn-secondary">
                    Open WhatsApp Chat
                  </a>
                ) : (
                  <p className="text-caption">Add WhatsApp number to enable 1-click chat.</p>
                )}
              </div>
            </div>

            <div>
              <p className="section-title">Product Photos</p>
              <div className="flex items-center gap-2 mb-2">
                <button className="btn-secondary" onClick={() => fileInputRef.current?.click()}>+ Upload photos</button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={e => {
                    void onUploadPhotos(selected.id, e.target.files)
                    e.currentTarget.value = ""
                  }}
                />
                <span className="text-caption">{uploadingPhotos ? "Uploading..." : `${selected.productPhotos.length} photo(s)`}</span>
              </div>
              {selected.productPhotos.length === 0 ? (
                <p className="text-caption">No photos uploaded yet.</p>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {selected.productPhotos.map((photo, i) => (
                    <div key={`${selected.id}-${i}`} className="relative rounded-lg overflow-hidden border border-surface-border">
                      <img src={photo} alt={`Product photo ${i + 1}`} className="w-full h-20 object-cover" />
                      <button
                        onClick={() => removeClientProductPhoto(selected.id, i)}
                        className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/70 text-white text-xs"
                        aria-label="Remove product photo"
                      >
                        x
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div>
            <p className="section-title">Notes / Discussion Log</p>
            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {selected.discussion.length === 0 && (
                <p className="text-caption italic">No discussion yet.</p>
              )}
              {[...selected.discussion].reverse().map(msg => (
                <div key={msg.id} className="rounded-lg border border-surface-border bg-surface-panel px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className={clsx("text-xs font-semibold", msg.author === "me" ? "text-brand-red" : "text-ink-secondary")}>
                      {msg.author === "me" ? "Me" : "Agent"}
                    </span>
                    <span className="text-2xs">{new Date(msg.date).toLocaleString()}</span>
                  </div>
                  <p className="text-sm text-ink-secondary mt-1 whitespace-pre-wrap">{msg.text}</p>
                </div>
              ))}
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <select
                className="input w-auto"
                value={discussionAuthor}
                onChange={e => setDiscussionAuthor(e.target.value as "me" | "agent")}
              >
                {AUTHOR_OPTIONS.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
              </select>
              <input
                className="input flex-1 min-w-[220px]"
                value={discussionText}
                onChange={e => setDiscussionText(e.target.value)}
                onKeyDown={e => e.key === "Enter" && submitDiscussion()}
                placeholder="Write what happened in this client conversation"
              />
              <button className="btn-primary" onClick={submitDiscussion}>Add Log</button>
            </div>
          </div>

          <div>
            <p className="section-title">Client AI Chat</p>
            <div className="card p-3 space-y-3">
              <div className="flex items-center gap-2">
                <select
                  className="input w-auto"
                  value={activeAgentId}
                  onChange={e => setActiveAgentId(e.target.value as AgentId)}
                >
                  {AGENTS.map(agent => (
                    <option key={agent.id} value={agent.id}>{agent.avatar} {agent.name} - {agent.role}</option>
                  ))}
                </select>
                <span className="text-caption">Memory: this client + this agent</span>
              </div>

              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {agentMessages.length === 0 && (
                  <p className="text-caption italic">Start a focused chat with {activeAgent.name} for this client.</p>
                )}
                {agentMessages.map((msg, i) => (
                  <div key={`${msg.role}-${i}`} className={clsx("rounded-lg px-3 py-2 text-sm", msg.role === "user" ? "bg-brand-red/20 border border-brand-red/40" : "bg-surface-panel border border-surface-border")}>
                    <p className="text-xs mb-1 text-ink-muted">{msg.role === "user" ? "You" : activeAgent.name}</p>
                    <p className="text-ink-secondary whitespace-pre-wrap">{msg.content}</p>
                  </div>
                ))}
                {agentLoading && <p className="text-caption">{activeAgent.name} is thinking...</p>}
              </div>

              <div className="flex gap-2">
                <input
                  className="input flex-1"
                  value={agentInput}
                  onChange={e => setAgentInput(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && sendAgentMessage()}
                  placeholder={`Ask ${activeAgent.name} about ${selected.name}`}
                  disabled={agentLoading}
                />
                <button className="btn-primary" onClick={sendAgentMessage} disabled={agentLoading || !agentInput.trim()}>
                  Send
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
