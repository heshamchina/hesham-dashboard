"use client"
import { useState } from "react"
import { useStore } from "@/lib/store"
import { LineChart, Line, ResponsiveContainer, Tooltip, XAxis } from "recharts"

export default function SocialSection() {
  const { followerLog, logFollowers } = useStore()
  const [igInput, setIgInput] = useState("")
  const [xInput, setXInput] = useState("")

  const last30 = followerLog.slice(-30)
  const latest = last30[last30.length - 1]
  const yesterday = last30[last30.length - 2]
  const week7ago = last30[Math.max(0, last30.length - 8)]
  const month30ago = last30[0]

  const igDelta1 = latest && yesterday ? latest.ig - yesterday.ig : 0
  const igDelta7 = latest && week7ago ? latest.ig - week7ago.ig : 0
  const igDelta30 = latest && month30ago ? latest.ig - month30ago.ig : 0
  const xDelta1 = latest && yesterday ? latest.x - yesterday.x : 0

  const avgDailyIg = last30.length > 1
    ? Math.round(igDelta30 / Math.min(30, last30.length - 1))
    : 0
  const projectedIg = latest ? latest.ig + avgDailyIg * 30 : 0

  function handleLog() {
    const ig = parseInt(igInput)
    const x = parseInt(xInput)
    if (ig > 0 || x > 0) {
      logFollowers(ig || latest?.ig || 0, x || latest?.x || 0)
      setIgInput("")
      setXInput("")
    }
  }

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Social Growth</h2>
        <span className="text-xs text-gray-400">{followerLog.length} days logged</span>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-gradient-to-br from-pink-50 to-purple-50 rounded-xl p-3">
          <p className="text-xs text-gray-500 mb-1">📸 Instagram</p>
          <p className="text-2xl font-bold text-gray-900">{latest?.ig ? latest.ig.toLocaleString() : "—"}</p>
          <div className="flex gap-3 mt-1 text-xs">
            <span className={igDelta1 >= 0 ? "text-green-600" : "text-red-500"}>
              {igDelta1 >= 0 ? "+" : ""}{igDelta1} today
            </span>
            <span className={igDelta7 >= 0 ? "text-green-600" : "text-red-500"}>
              {igDelta7 >= 0 ? "+" : ""}{igDelta7} /7d
            </span>
          </div>
          <p className="text-xs text-gray-400 mt-1">+{igDelta30}/30d · avg +{avgDailyIg}/day</p>
          {projectedIg > 0 && <p className="text-xs text-brand-gold font-medium mt-1">📈 ~{projectedIg.toLocaleString()} next month</p>}
        </div>

        <div className="bg-gradient-to-br from-gray-50 to-blue-50 rounded-xl p-3">
          <p className="text-xs text-gray-500 mb-1">𝕏 X (Twitter)</p>
          <p className="text-2xl font-bold text-gray-900">{latest?.x ? latest.x.toLocaleString() : "—"}</p>
          <div className="flex gap-3 mt-1 text-xs">
            <span className={xDelta1 >= 0 ? "text-green-600" : "text-red-500"}>
              {xDelta1 >= 0 ? "+" : ""}{xDelta1} today
            </span>
          </div>
        </div>
      </div>

      {/* Chart */}
      {last30.length > 3 && (
        <div className="h-24 mb-4">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={last30}>
              <XAxis dataKey="date" hide />
              <Tooltip
                formatter={(val: number) => [val.toLocaleString(), "IG Followers"]}
                labelFormatter={(l) => l}
                contentStyle={{ fontSize: 11 }}
              />
              <Line type="monotone" dataKey="ig" stroke="#A51C1C" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Log today */}
      <div className="flex gap-2 items-end">
        <div className="flex-1">
          <label className="text-xs text-gray-400 mb-1 block">Instagram followers</label>
          <input className="input text-sm" type="number" placeholder={latest?.ig?.toString() || "32400"}
            value={igInput} onChange={e => setIgInput(e.target.value)} />
        </div>
        <div className="flex-1">
          <label className="text-xs text-gray-400 mb-1 block">X followers</label>
          <input className="input text-sm" type="number" placeholder={latest?.x?.toString() || "1200"}
            value={xInput} onChange={e => setXInput(e.target.value)} />
        </div>
        <button onClick={handleLog} className="btn-primary px-3 py-2 shrink-0">Log Today</button>
      </div>
    </div>
  )
}
