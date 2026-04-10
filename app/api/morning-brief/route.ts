import { NextRequest, NextResponse } from "next/server"
import OpenAI from "openai"

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

export async function POST(req: NextRequest) {
  try {
    const { deals, projects, followerLog, streaks, weeklyGoals, dailyFocus } = await req.json()

    const igToday = followerLog[followerLog.length - 1]?.ig || 0
    const ig7ago = followerLog[Math.max(0, followerLog.length - 8)]?.ig || igToday
    const xToday = followerLog[followerLog.length - 1]?.x || 0

    const openDeals = deals.filter((d: any) => d.status !== "paid")
    const totalPipelineValue = openDeals.reduce((s: number, d: any) => s + d.value, 0)
    const paidThisMonth = deals
      .filter((d: any) => d.status === "paid" && new Date(d.updatedAt).getMonth() === new Date().getMonth())
      .reduce((s: number, d: any) => s + d.value, 0)

    const staleDays = 3
    const staleDeals = openDeals.filter((d: any) => {
      const daysSince = (Date.now() - new Date(d.updatedAt).getTime()) / 86400000
      return daysSince >= staleDays
    })

    const prompt = `You are Hesham's personal AI business assistant. Hesham is a Jordanian entrepreneur based in Beijing, China. He runs: sourcing & trade facilitation for Arab markets, China travel itinerary planning, wholesale market guides, and content creation (@heshaminchina, 32K+ Instagram followers).

Today's data:
- Open deals: ${openDeals.length} worth $${totalPipelineValue.toLocaleString()}
- Paid this month: $${paidThisMonth.toLocaleString()}
- Stale deals (no update ${staleDays}+ days): ${staleDeals.map((d: any) => d.client).join(", ") || "none"}
- Instagram: ${igToday.toLocaleString()} followers (+${igToday - ig7ago} this week)
- X followers: ${xToday.toLocaleString()}
- Posting streak: ${streaks.postingStreak} days
- Check-in streak: ${streaks.checkinStreak} days
- Active projects: ${projects.map((p: any) => `${p.name} (${p.health})`).join(", ")}
- Today's mission: ${dailyFocus?.mainMission || "not set yet"}
- Weekly goals: ${weeklyGoals.length} set, ${weeklyGoals.filter((g: any) => g.progress === 100).length} completed

Write a sharp, personal morning briefing for Hesham in 3-4 sentences. Be direct, specific, motivating but realistic. Mention the most important thing he should focus on today. Reference specific numbers. End with one actionable recommendation. Write in English, conversational tone like a trusted advisor. Do NOT start with "Good morning" — start with the most important insight.`

    const res = await openai.chat.completions.create({
      model: "gpt-4o",
      max_tokens: 200,
      messages: [{ role: "user", content: prompt }]
    })

    return NextResponse.json({ brief: res.choices[0].message.content })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
