"use client"
import { useState } from "react"
import { useStore } from "@/lib/store"
import { supabase } from "@/lib/supabase"
import { LineChart, Line, ResponsiveContainer, Tooltip, XAxis } from "recharts"

export default function SocialSection() {
  const { followerLog, logFollowers } = useStore()
  const [syncing, setSyncing] = useState(false)
  const [syncMsg, setSyncMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const last30    = followerLog.slice(-30)
  const latest    = last30[last30.length - 1]
  const yesterday = last30[last30.length - 2]
  const week7ago  = last30[Math.max(0, last30.length - 8)]
  const month30ago = last30[0]

  const igDelta1  = latest && yesterday  ? latest.ig - yesterday.ig  : 0
  const igDelta7  = latest && week7ago   ? latest.ig - week7ago.ig   : 0
  const igDelta30 = latest && month30ago ? latest.ig - month30ago.ig : 0
  const xDelta1   = latest && yesterday  ? latest.x  - yesterday.x   : 0

  const avgDailyIg  = last30.length > 1 ? Math.round(igDelta30 / Math.min(30, last30.length - 1)) : 0
  const projectedIg = latest ? latest.ig + avgDailyIg * 30 : 0

  // Last synced = most recent entry date in follower_log
  const lastSyncedDate = latest?.date ?? null

  async function syncNow() {
    setSyncing(true)
    setSyncMsg(null)
    try {
      const res = await fetch("/api/scrape/run-daily", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      })
      const data = await res.json()

      if (!res.ok || !data.ok) {
        setSyncMsg({ ok: false, text: data.error ?? "Sync failed" })
        return
      }

      // If a new follower count was logged, pull it into the Zustand store
      if (data.followersLogged !== null && data.followersLogged !== undefined) {
        const today = new Date().toISOString().split("T")[0]
        const alreadyHasToday = followerLog.some(e => e.date === today)
        if (!alreadyHasToday) {
          logFollowers(data.followersLogged, latest?.x ?? 0)
        }
      }

      const followers = data.followersLogged
      setSyncMsg({
        ok: true,
        text: followers
          ? `Synced — ${followers.toLocaleString()} followers`
          : "Sync complete (already up to date)",
      })
    } catch (e: any) {
      setSyncMsg({ ok: false, text: e.message ?? "Network error" })
    } finally {
      setSyncing(false)
    }
  }

  return (
    <div className="rounded-2xl p-4 space-y-4" style={{ background: "#1A1A1A", border: "1px solid #252525" }}>
      {/* Header row */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="font-bold text-ink-primary">Social Growth</h2>
          <p className="text-xs text-ink-muted mt-0.5">{followerLog.length} days tracked</p>
        </div>

        <div className="flex items-center gap-3">
          {/* Last synced */}
          <span className="text-xs text-ink-muted">
            {lastSyncedDate
              ? `Last synced: ${new Date(lastSyncedDate).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}`
              : "Never synced"}
          </span>

          {/* Sync Now button */}
          <button
            onClick={syncNow}
            disabled={syncing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all disabled:opacity-60"
            style={{ background: syncing ? "#242424" : "#A51C1C", color: "#fff", border: "1px solid #A51C1C" }}
          >
            {syncing ? (
              <>
                <span
                  className="w-3 h-3 rounded-full border-2 border-white border-t-transparent inline-block"
                  style={{ animation: "spin 0.8s linear infinite" }}
                />
                Syncing…
              </>
            ) : (
              <>↻ Sync Now</>
            )}
          </button>
        </div>
      </div>

      {/* Sync status message */}
      {syncMsg && (
        <div
          className="rounded-lg px-3 py-2 text-xs font-medium"
          style={syncMsg.ok
            ? { background: "#0D2016", color: "#4ADE80", border: "1px solid #1A4A2E" }
            : { background: "#3D0A0A", color: "#FF8080", border: "1px solid #5A1414" }}
        >
          {syncMsg.ok ? "✓" : "✕"} {syncMsg.text}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl p-3" style={{ background: "#242424" }}>
          <p className="text-xs text-ink-muted mb-1">📸 Instagram</p>
          <p className="text-2xl font-bold text-ink-primary">
            {latest?.ig ? latest.ig.toLocaleString() : "—"}
          </p>
          <div className="flex gap-3 mt-1 text-xs">
            <span style={{ color: igDelta1 >= 0 ? "#4ADE80" : "#EF4444" }}>
              {igDelta1 >= 0 ? "+" : ""}{igDelta1} today
            </span>
            <span style={{ color: igDelta7 >= 0 ? "#4ADE80" : "#EF4444" }}>
              {igDelta7 >= 0 ? "+" : ""}{igDelta7} /7d
            </span>
          </div>
          <p className="text-xs text-ink-muted mt-1">
            +{igDelta30}/30d · avg +{avgDailyIg}/day
          </p>
          {projectedIg > 0 && (
            <p className="text-xs font-medium mt-1" style={{ color: "#D4A017" }}>
              📈 ~{projectedIg.toLocaleString()} next month
            </p>
          )}
        </div>

        <div className="rounded-xl p-3" style={{ background: "#242424" }}>
          <p className="text-xs text-ink-muted mb-1">𝕏 X (Twitter)</p>
          <p className="text-2xl font-bold text-ink-primary">
            {latest?.x ? latest.x.toLocaleString() : "—"}
          </p>
          <div className="flex gap-3 mt-1 text-xs">
            <span style={{ color: xDelta1 >= 0 ? "#4ADE80" : "#EF4444" }}>
              {xDelta1 >= 0 ? "+" : ""}{xDelta1} today
            </span>
          </div>
        </div>
      </div>

      {/* Chart */}
      {last30.length > 3 && (
        <div className="h-24">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={last30}>
              <XAxis dataKey="date" hide />
              <Tooltip
                formatter={(val: number) => [val.toLocaleString(), "IG Followers"]}
                labelFormatter={l => l}
                contentStyle={{ fontSize: 11, background: "#1A1A1A", border: "1px solid #2A2A2A", borderRadius: 8 }}
              />
              <Line type="monotone" dataKey="ig" stroke="#A51C1C" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {last30.length === 0 && (
        <div className="text-center py-8 text-ink-muted">
          <p className="text-3xl mb-2">📊</p>
          <p className="text-sm">No data yet — hit Sync Now to pull follower count</p>
        </div>
      )}
    </div>
  )
}
