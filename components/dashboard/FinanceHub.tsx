"use client"
import { useState, useMemo } from "react"
import { useStore } from "@/lib/store"
import clsx from "clsx"
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts"
import type { ExpenseCategory } from "@/types"

const CAT_CONFIG: Record<ExpenseCategory, { label: string; emoji: string; color: string }> = {
  travel:    { label: "Travel",    emoji: "✈️",  color: "#A51C1C" },
  tools:     { label: "Tools",     emoji: "🛠️",  color: "#6366f1" },
  marketing: { label: "Marketing", emoji: "📣",  color: "#D4A017" },
  office:    { label: "Office",    emoji: "🏢",  color: "#0ea5e9" },
  food:      { label: "Food",      emoji: "🍜",  color: "#22c55e" },
  other:     { label: "Other",     emoji: "📦",  color: "#94a3b8" },
}

const CURRENCIES = ["USD", "CNY", "JOD", "SAR", "AED", "EUR"]

export default function FinanceHub() {
  const { deals, expenses, addExpense, deleteExpense, revenueSettings } = useStore()
  const [showForm, setShowForm] = useState(false)
  const [activeTab, setActiveTab] = useState<"overview" | "expenses" | "revenue">("overview")
  const [form, setForm] = useState({
    description: "", amount: 0, currency: "USD",
    category: "travel" as ExpenseCategory, date: new Date().toISOString().split("T")[0]
  })

  const now = new Date()
  const currentMonth = now.getMonth()
  const currentYear = now.getFullYear()

  // Revenue by month (last 6 months)
  const revenueByMonth = useMemo(() => {
    const months: { month: string; revenue: number; deals: number }[] = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date(currentYear, currentMonth - i, 1)
      const monthDeals = deals.filter(deal =>
        deal.status === "paid" &&
        new Date(deal.updatedAt).getMonth() === d.getMonth() &&
        new Date(deal.updatedAt).getFullYear() === d.getFullYear()
      )
      months.push({
        month: d.toLocaleDateString("en-GB", { month: "short" }),
        revenue: monthDeals.reduce((s, d) => s + d.value, 0),
        deals: monthDeals.length
      })
    }
    return months
  }, [deals])

  // This month stats
  const thisMonthRevenue = deals
    .filter(d => d.status === "paid" && new Date(d.updatedAt).getMonth() === currentMonth && new Date(d.updatedAt).getFullYear() === currentYear)
    .reduce((s, d) => s + d.value, 0)

  const thisMonthExpenses = expenses
    .filter(e => new Date(e.date).getMonth() === currentMonth && new Date(e.date).getFullYear() === currentYear)
    .reduce((s, e) => s + e.amount, 0)

  const netProfit = thisMonthRevenue - thisMonthExpenses
  const target = revenueSettings.monthlyTarget

  // Expense by category this month
  const expByCategory = useMemo(() => {
    const cats = Object.keys(CAT_CONFIG) as ExpenseCategory[]
    return cats.map(cat => ({
      cat,
      amount: expenses
        .filter(e => e.category === cat && new Date(e.date).getMonth() === currentMonth)
        .reduce((s, e) => s + e.amount, 0)
    })).filter(x => x.amount > 0)
  }, [expenses])

  function handleAdd() {
    if (!form.description.trim() || !form.amount) return
    addExpense(form)
    setForm({ description: "", amount: 0, currency: "USD", category: "travel", date: new Date().toISOString().split("T")[0] })
    setShowForm(false)
  }

  const recentExpenses = expenses.slice(0, 20)

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-display">Finance Hub</h2>
          <p className="text-sm text-gray-400">Revenue · Expenses · Net Profit</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="btn-primary">+ Add Expense</button>
      </div>

      {/* Add Expense Form */}
      {showForm && (
        <div className="card p-4 border-l-4 border-brand-gold">
          <h3 className="font-semibold mb-3">New Expense</h3>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div className="col-span-2">
              <label className="label">Description</label>
              <input className="input" placeholder="Flight to Canton Fair" value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
            </div>
            <div>
              <label className="label">Amount</label>
              <input className="input" type="number" placeholder="0" value={form.amount || ""}
                onChange={e => setForm(f => ({ ...f, amount: parseFloat(e.target.value) || 0 }))} />
            </div>
            <div>
              <label className="label">Currency</label>
              <select className="input" value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}>
                {CURRENCIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Category</label>
              <select className="input" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value as ExpenseCategory }))}>
                {Object.entries(CAT_CONFIG).map(([k, v]) => (
                  <option key={k} value={k}>{v.emoji} {v.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Date</label>
              <input className="input" type="date" value={form.date}
                onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={handleAdd} className="btn-gold">Save Expense</button>
            <button onClick={() => setShowForm(false)} className="btn-secondary">Cancel</button>
          </div>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="card p-4 text-center">
          <p className="text-xs text-gray-400 mb-1">Revenue (month)</p>
          <p className="text-2xl font-bold text-brand-red">${thisMonthRevenue.toLocaleString()}</p>
          <p className="text-xs text-gray-400 mt-1">{Math.round((thisMonthRevenue / target) * 100)}% of target</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-xs text-gray-400 mb-1">Expenses (month)</p>
          <p className="text-2xl font-bold text-orange-500">${thisMonthExpenses.toLocaleString()}</p>
          <p className="text-xs text-gray-400 mt-1">{expenses.filter(e => new Date(e.date).getMonth() === currentMonth).length} transactions</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-xs text-gray-400 mb-1">Net Profit</p>
          <p className={clsx("text-2xl font-bold", netProfit >= 0 ? "text-green-600" : "text-red-500")}>
            {netProfit >= 0 ? "+" : ""}${netProfit.toLocaleString()}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            {thisMonthRevenue > 0 ? Math.round((netProfit / thisMonthRevenue) * 100) : 0}% margin
          </p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-xs text-gray-400 mb-1">Pipeline</p>
          <p className="text-2xl font-bold text-brand-gold">
            ${deals.filter(d => d.status !== "paid").reduce((s, d) => s + d.value, 0).toLocaleString()}
          </p>
          <p className="text-xs text-gray-400 mt-1">{deals.filter(d => d.status !== "paid").length} open deals</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex rounded-lg p-0.5 w-fit border border-surface-border" style={{ backgroundColor: "#1A1A1A" }}>
        {(["overview", "expenses", "revenue"] as const).map(t => (
          <button key={t} onClick={() => setActiveTab(t)}
            className={clsx("px-4 py-1.5 rounded-md text-sm font-medium transition-colors capitalize",
              activeTab === t ? "text-ink-primary" : "text-ink-muted hover:text-ink-secondary"
            )}
            style={activeTab === t ? { backgroundColor: "#2E2E2E" } : {}}>{t}</button>
        ))}
      </div>

      {/* Overview */}
      {activeTab === "overview" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Revenue chart */}
          <div className="card p-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Revenue — Last 6 Months</p>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={revenueByMonth} barSize={28}>
                <XAxis dataKey="month" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis hide />
                <Tooltip
                  formatter={(val: number) => [`$${val.toLocaleString()}`, "Revenue"]}
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e5e7eb" }}
                />
                <Bar dataKey="revenue" radius={[4, 4, 0, 0]}>
                  {revenueByMonth.map((_, i) => (
                    <Cell key={i} fill={i === revenueByMonth.length - 1 ? "#A51C1C" : "#D4A017"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Expense by category */}
          <div className="card p-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Expenses This Month</p>
            {expByCategory.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">No expenses logged</p>
            ) : (
              <div className="space-y-2">
                {expByCategory.sort((a, b) => b.amount - a.amount).map(({ cat, amount }) => {
                  const cfg = CAT_CONFIG[cat]
                  const pct = thisMonthExpenses > 0 ? (amount / thisMonthExpenses) * 100 : 0
                  return (
                    <div key={cat}>
                      <div className="flex justify-between text-xs mb-1">
                        <span>{cfg.emoji} {cfg.label}</span>
                        <span className="font-semibold">${amount.toLocaleString()}</span>
                      </div>
                      <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: "#2A2A2A" }}>
                        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: cfg.color }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Expenses list */}
      {activeTab === "expenses" && (
        <div className="card overflow-hidden">
          {recentExpenses.length === 0 ? (
            <div className="p-8 text-center text-gray-400">
              <p className="text-3xl mb-2">💸</p>
              <p className="font-medium">No expenses logged yet</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Description</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Category</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Date</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Amount</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {recentExpenses.map(e => {
                  const cfg = CAT_CONFIG[e.category]
                  return (
                    <tr key={e.id} className="hover:bg-gray-50 group">
                      <td className="px-4 py-3 font-medium text-gray-900">{e.description}</td>
                      <td className="px-4 py-3">
                        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                          {cfg.emoji} {cfg.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{new Date(e.date).toLocaleDateString("en-GB")}</td>
                      <td className="px-4 py-3 text-right font-bold text-orange-600">
                        -{e.currency} {e.amount.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button onClick={() => deleteExpense(e.id)}
                          className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400 transition-opacity">✕</button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Revenue history */}
      {activeTab === "revenue" && (
        <div className="card overflow-hidden">
          {deals.filter(d => d.status === "paid").length === 0 ? (
            <div className="p-8 text-center text-gray-400">
              <p className="text-3xl mb-2">💰</p>
              <p className="font-medium">No paid deals yet</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Client</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Stream</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Paid</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {deals.filter(d => d.status === "paid")
                  .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
                  .map(d => (
                    <tr key={d.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900">{d.client}</td>
                      <td className="px-4 py-3 text-gray-500 capitalize text-xs">{d.stream}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{new Date(d.updatedAt).toLocaleDateString("en-GB")}</td>
                      <td className="px-4 py-3 text-right font-bold text-green-600">+${d.value.toLocaleString()}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  )
}
