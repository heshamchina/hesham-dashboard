import { NextRequest, NextResponse } from "next/server"
import OpenAI from "openai"

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

export async function POST(req: NextRequest) {
  try {
    const { messages, context } = await req.json()

    // Build rich context from dashboard data
    const ctx = context || {}
    const now = new Date()

    const deals = ctx.deals || []
    const projects = ctx.projects || []
    const footage = ctx.footage || []
    const contacts = ctx.contacts || []
    const weeklyGoals = ctx.weeklyGoals || []
    const contentIdeas = ctx.contentIdeas || []
    const streaks = ctx.streaks || {}
    const followerLog = ctx.followerLog || []
    const captures = ctx.captures || []
    const expenses = ctx.expenses || []
    const dailyFocus = ctx.dailyFocus || null

    const openDeals = deals.filter((d: any) => d.status !== "paid")
    const staleDeals = openDeals.filter((d: any) =>
      (Date.now() - new Date(d.updatedAt).getTime()) / 86400000 >= 3
    )
    const paidThisMonth = deals
      .filter((d: any) => d.status === "paid" && new Date(d.updatedAt).getMonth() === now.getMonth())
      .reduce((s: number, d: any) => s + (Number(d.value) || 0), 0)

    const unusedFootage = footage.filter((f: any) => f.status === "unused")
    const latestIG = followerLog[followerLog.length - 1]?.ig || 0
    const ig7ago = followerLog[Math.max(0, followerLog.length - 8)]?.ig || latestIG
    const igGrowth7d = latestIG - ig7ago

    const thisWeekGoals = weeklyGoals.filter((g: any) => {
      const monday = (() => {
        const d = new Date(); const day = d.getDay()
        const diff = d.getDate() - day + (day === 0 ? -6 : 1)
        return new Date(new Date().setDate(diff)).toISOString().split("T")[0]
      })()
      return g.weekStart === monday
    })

    const systemPrompt = `You are Hesham's personal AI assistant — built into his private command center dashboard.

## Who is Hesham
- Jordanian entrepreneur, living in Beijing China for 7+ years
- Visited 80+ Chinese cities
- Businesses: China-Arab sourcing/trade facilitation, travel itinerary planning, wholesale market guides
- Content creator: @heshaminchina on Instagram (${latestIG.toLocaleString()} followers, +${igGrowth7d} this week)
- Audience: Arab travelers, buyers, importers curious about China
- Language: Speaks Jordanian Arabic, English, some Chinese

## Current Dashboard Data (live)
**Today:** ${now.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
**Daily focus:** ${dailyFocus?.mainMission || "not set"}
**Checklist:** ${dailyFocus?.checklist?.length || 0} tasks, ${dailyFocus?.checklist?.filter((i: any) => i.done).length || 0} done

**Revenue:**
- Open deals: ${openDeals.length} worth $${openDeals.reduce((s: number, d: any) => s + (Number(d.value) || 0), 0).toLocaleString()}
- Paid this month: $${paidThisMonth.toLocaleString()}
- Stale deals needing follow-up: ${staleDeals.length > 0 ? staleDeals.map((d: any) => `${d.client} ($${d.value})`).join(", ") : "none"}
- Deal breakdown: ${["sourcing","itinerary","markets"].map(s => `${s}: ${deals.filter((d: any) => d.stream === s).length}`).join(", ")}

**Content & Footage:**
- Unused footage clips: ${unusedFootage.length}${unusedFootage.length > 0 ? ` — "${unusedFootage.slice(0,3).map((f: any) => f.title).join('", "')}"` : ""}
- Content pipeline: ${contentIdeas.length} ideas (${contentIdeas.filter((i: any) => i.status === "idea").length} ideas, ${contentIdeas.filter((i: any) => i.status === "scripted").length} scripted, ${contentIdeas.filter((i: any) => i.status === "posted").length} posted)
- Posting streak: ${streaks.postingStreak || 0} days | Check-in streak: ${streaks.checkinStreak || 0} days

**Projects:**
${projects.map((p: any) => `- ${p.name}: ${p.health}, ${p.progress}% complete — next: ${p.nextAction}`).join("\n") || "- none"}

**Weekly Goals (${thisWeekGoals.filter((g: any) => g.progress === 100).length}/${thisWeekGoals.length} done):**
${thisWeekGoals.map((g: any) => `- ${g.text}: ${g.progress}%`).join("\n") || "- none set"}

**Contacts:** ${contacts.length} in network
**Pending ideas/captures:** ${captures.filter((c: any) => !c.processed).length}

## Your Role
You are a trusted, direct advisor who knows everything about Hesham's business and life.
- Help him plan his day, week, or content strategy
- Brainstorm content ideas based on his footage and niche
- Discuss deals, give advice on clients
- Help write scripts, hooks, captions
- Give honest feedback — don't sugarcoat
- Be conversational, natural — like a smart friend who also happens to be a business strategist
- When he says "let's plan today" — give a concrete, prioritized plan based on real data
- When he asks about footage — reference the actual clip titles you know about
- Keep responses concise unless he asks for detail
- Use English by default but switch to Arabic if he does

## Tone
Direct. Practical. Warm but no fluff. Like a smart COO who also understands content creation.`

    const res = await openai.chat.completions.create({
      model: "gpt-4o",
      max_tokens: 800,
      temperature: 0.8,
      messages: [
        { role: "system", content: systemPrompt },
        ...messages
      ]
    })

    return NextResponse.json({
      reply: res.choices[0].message.content,
      usage: res.usage,
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
