import { NextRequest, NextResponse } from "next/server"
import OpenAI from "openai"
import { supabase } from "@/lib/supabase"
import { AGENT_MAP } from "@/lib/agents"

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
const agent = AGENT_MAP.omar

export async function POST(req: NextRequest) {
  try {
    const { input, context, sessionId } = await req.json()

    // Build context block from live dashboard data
    const { deals = [], streaks = {}, projects = [], followerLog = [], weeklyGoals = [], dailyFocus = null } = context || {}

    const now = new Date()
    const openDeals = deals.filter((d: any) => d.status !== "paid")
    const paidThisMonth = deals
      .filter((d: any) => d.status === "paid" && new Date(d.updatedAt).getMonth() === now.getMonth())
      .reduce((s: number, d: any) => s + (Number(d.value) || 0), 0)
    const totalPipeline = openDeals.reduce((s: number, d: any) => s + (Number(d.value) || 0), 0)
    const staleDeals = openDeals.filter((d: any) => {
      const days = (Date.now() - new Date(d.updatedAt).getTime()) / 86400000
      return days >= 3
    })
    const igNow = followerLog[followerLog.length - 1]?.ig || 0
    const ig7ago = followerLog[Math.max(0, followerLog.length - 8)]?.ig || igNow
    const thisMonday = (() => {
      const d = new Date()
      const diff = d.getDate() - d.getDay() + (d.getDay() === 0 ? -6 : 1)
      return new Date(d.setDate(diff)).toISOString().split("T")[0]
    })()
    const weekGoals = weeklyGoals.filter((g: any) => g.weekStart === thisMonday)
    const zeroGoals = weekGoals.filter((g: any) => g.progress === 0)

    const contextBlock = `
DASHBOARD SNAPSHOT (${now.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}):
- Revenue paid this month: $${paidThisMonth.toLocaleString()}
- Open pipeline: $${totalPipeline.toLocaleString()} across ${openDeals.length} deals
- Stale deals (3+ days no update): ${staleDeals.length > 0 ? staleDeals.map((d: any) => `${d.client} ($${Number(d.value||0).toLocaleString()}, ${Math.floor((Date.now() - new Date(d.updatedAt).getTime()) / 86400000)}d stale)`).join("; ") : "none"}
- Instagram: ${igNow.toLocaleString()} followers (${igNow - ig7ago >= 0 ? "+" : ""}${(igNow - ig7ago).toLocaleString()} this week)
- Posting streak: ${streaks.postingStreak || 0} days | Check-in streak: ${streaks.checkinStreak || 0} days
- Active projects: ${projects.length > 0 ? projects.map((p: any) => `${p.name} (${p.health})`).join(", ") : "none"}
- Today's mission: ${dailyFocus?.mainMission || "not set"}
- Weekly goals: ${weekGoals.length} set | ${zeroGoals.length} at 0% progress${now.getDay() >= 3 ? " (mid-week — flag these)" : ""}
`.trim()

    const userContent = input
      ? `${contextBlock}\n\nHesham asks: ${input}`
      : `${contextBlock}\n\nGive Hesham his morning strategic assessment.`

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      max_tokens: 400,
      temperature: 0.7,
      messages: [
        { role: "system", content: agent.systemPrompt },
        { role: "user", content: userContent },
      ],
    })

    const output = completion.choices[0].message.content || ""

    // Save to agent_tasks table
    const { data: task } = await supabase
      .from("agent_tasks")
      .insert({
        agent_id: agent.id,
        agent_name: agent.name,
        task_type: agent.taskType,
        input: userContent,
        output,
        session_id: sessionId || null,
        status: "done",
      })
      .select("id")
      .single()

    return NextResponse.json({ output, taskId: task?.id || null })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
