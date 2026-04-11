"use client"
import { useState, useRef, useEffect } from "react"
import { useStore } from "@/lib/store"
import clsx from "clsx"

interface Message {
  role: "user" | "assistant"
  content: string
  ts: number
}

const QUICK_PROMPTS = [
  { label: "خطط يومي", prompt: "Let's plan today. What should I focus on given my current data?" },
  { label: "أفكار محتوى", prompt: "Give me 3 content ideas based on my unused footage and what's trending for my niche." },
  { label: "وضع الصفقات", prompt: "Give me a quick status on my deals. Which ones need attention right now?" },
  { label: "مراجعة أسبوعية", prompt: "How is my week going? What am I behind on and what's going well?" },
  { label: "سكريبت سريع", prompt: "I need a quick 60-second reel hook about China for my Arabic audience. Surprise me with a topic." },
  { label: "ماذا أنشر اليوم؟", prompt: "What should I post today? Consider my streak, footage, and what would perform best." },
]

export default function AIChat() {
  const store = useStore()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [showQuick, setShowQuick] = useState(true)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, loading])

  // Build full context from store
  function getContext() {
    return {
      deals: store.deals,
      projects: store.projects,
      footage: store.footage,
      contacts: store.contacts,
      weeklyGoals: store.weeklyGoals,
      contentIdeas: store.contentIdeas,
      streaks: store.streaks,
      followerLog: store.followerLog,
      captures: store.captures,
      expenses: store.expenses,
      dailyFocus: store.dailyFocus,
      revenueSettings: store.revenueSettings,
    }
  }

  async function send(text?: string) {
    const content = (text || input).trim()
    if (!content || loading) return

    const userMsg: Message = { role: "user", content, ts: Date.now() }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    setInput("")
    setShowQuick(false)
    setLoading(true)

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: newMessages.map(m => ({ role: m.role, content: m.content })),
          context: getContext(),
        })
      })
      const data = await res.json()
      if (data.reply) {
        setMessages(m => [...m, { role: "assistant", content: data.reply, ts: Date.now() }])
      }
    } catch {}
    setLoading(false)
    inputRef.current?.focus()
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  function clearChat() {
    setMessages([])
    setShowQuick(true)
  }

  const isEmpty = messages.length === 0

  return (
    <div className="flex flex-col h-full min-h-[600px]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-gradient-to-br from-brand-red to-brand-red-dark rounded-xl flex items-center justify-center text-white text-lg shadow-sm">
            🤖
          </div>
          <div>
            <p className="font-bold text-gray-900 text-sm">Hesham's AI</p>
            <p className="text-xs text-green-500 flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-green-400 rounded-full inline-block"></span>
              Online — knows your full dashboard
            </p>
          </div>
        </div>
        {!isEmpty && (
          <button onClick={clearChat} className="text-xs text-gray-400 hover:text-gray-600 transition-colors">
            Clear chat
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {isEmpty && (
          <div className="text-center py-8">
            <div className="text-5xl mb-3">👋</div>
            <p className="font-bold text-gray-800 text-lg">صباح الخير يا هشام</p>
            <p className="text-gray-400 text-sm mt-1 max-w-xs mx-auto">
              أنا عارف كل شي في الداشبورد — الصفقات، الكليبات، الأهداف. قلي إيش تبي نعمل.
            </p>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={clsx("flex gap-3", msg.role === "user" ? "justify-end" : "justify-start")}>
            {msg.role === "assistant" && (
              <div className="w-8 h-8 bg-gradient-to-br from-brand-red to-brand-red-dark rounded-lg flex items-center justify-center text-white text-sm shrink-0 mt-0.5 shadow-sm">
                🤖
              </div>
            )}
            <div className={clsx(
              "max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed",
              msg.role === "user"
                ? "bg-brand-red text-white rounded-tr-sm"
                : "bg-white border border-gray-100 text-gray-800 rounded-tl-sm shadow-sm"
            )} dir="auto">
              {msg.content.split("\n").map((line, j) => (
                <span key={j}>
                  {line}
                  {j < msg.content.split("\n").length - 1 && <br />}
                </span>
              ))}
            </div>
            {msg.role === "user" && (
              <div className="w-8 h-8 bg-gray-200 rounded-lg flex items-center justify-center text-sm shrink-0 mt-0.5">
                H
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="flex gap-3 justify-start">
            <div className="w-8 h-8 bg-gradient-to-br from-brand-red to-brand-red-dark rounded-lg flex items-center justify-center text-white text-sm shrink-0 shadow-sm">
              🤖
            </div>
            <div className="bg-white border border-gray-100 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
              <div className="flex gap-1 items-center h-5">
                <div className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                <div className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                <div className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Quick prompts */}
      {showQuick && (
        <div className="px-4 pb-3">
          <p className="text-xs text-gray-400 mb-2 font-medium">أو اختار سريع:</p>
          <div className="grid grid-cols-2 gap-1.5">
            {QUICK_PROMPTS.map((p, i) => (
              <button key={i} onClick={() => send(p.prompt)}
                className="text-xs bg-gray-50 hover:bg-brand-red/5 hover:border-brand-red/30 border border-gray-200 text-gray-700 hover:text-brand-red px-3 py-2 rounded-xl text-right transition-all font-medium"
                dir="rtl">
                {p.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="px-4 pb-4 pt-2 border-t border-gray-100">
        <div className="flex gap-2 items-end">
          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder="اكتب رسالة... (Enter للإرسال، Shift+Enter لسطر جديد)"
              rows={1}
              dir="auto"
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-brand-red/30 focus:border-brand-red transition-colors bg-white"
              style={{ minHeight: "44px", maxHeight: "120px" }}
              onInput={e => {
                const el = e.target as HTMLTextAreaElement
                el.style.height = "auto"
                el.style.height = Math.min(el.scrollHeight, 120) + "px"
              }}
            />
          </div>
          <button
            onClick={() => send()}
            disabled={loading || !input.trim()}
            className={clsx(
              "w-11 h-11 rounded-xl flex items-center justify-center transition-all shrink-0",
              input.trim() && !loading
                ? "bg-brand-red hover:bg-brand-red-dark text-white shadow-sm hover:shadow-md active:scale-95"
                : "bg-gray-100 text-gray-300 cursor-not-allowed"
            )}>
            {loading
              ? <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              : <span className="text-lg">↑</span>}
          </button>
        </div>
        <p className="text-xs text-gray-300 mt-1.5 text-center">
          Context: {store.deals.length} deals · {store.footage.length} clips · {store.projects.length} projects
        </p>
      </div>
    </div>
  )
}
