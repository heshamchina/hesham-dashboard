import { NextRequest, NextResponse } from "next/server"
import OpenAI from "openai"
import { supabase } from "@/lib/supabase"
import { AGENTS, AGENT_MAP, type AgentId } from "@/lib/agents"

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

// Which agents participate in a team meeting and in what order
const MEETING_AGENTS: AgentId[] = ["omar", "ziad", "nour", "layla", "khalid"]

async function runAgentTurn(
  agentId: AgentId,
  topic: string,
  thread: { agentName: string; content: string }[],
  context?: any
): Promise<string> {
  const agent = AGENT_MAP[agentId]

  // Build the conversation so far as context
  const priorExchanges = thread.length > 0
    ? `\nThe meeting so far:\n${thread.map(m => `${m.agentName}: ${m.content}`).join("\n\n")}`
    : ""

  // Omar gets dashboard data; others get the meeting thread only
  let contextBlock = ""
  if (agentId === "omar" && context) {
    const { deals = [], streaks = {}, projects = [], followerLog = [], weeklyGoals = [] } = context
    const now = new Date()
    const openDeals = deals.filter((d: any) => d.status !== "paid")
    const paidThisMonth = deals
      .filter((d: any) => d.status === "paid" && new Date(d.updatedAt).getMonth() === now.getMonth())
      .reduce((s: number, d: any) => s + (Number(d.value) || 0), 0)
    const totalPipeline = openDeals.reduce((s: number, d: any) => s + (Number(d.value) || 0), 0)
    const igNow = followerLog[followerLog.length - 1]?.ig || 0

    contextBlock = `
HESHAM'S CURRENT DATA:
- Revenue paid this month: $${paidThisMonth.toLocaleString()}
- Pipeline: $${totalPipeline.toLocaleString()} (${openDeals.length} open deals)
- Instagram: ${igNow.toLocaleString()} followers
- Posting streak: ${streaks.postingStreak || 0} days
- Active projects: ${projects.map((p: any) => p.name).join(", ") || "none"}
`
  }

  const userContent = `
TEAM MEETING TOPIC: "${topic}"
${contextBlock}${priorExchanges}

You are ${agent.name} (${agent.role}). Respond now — your turn in the meeting.
Be specific to the topic. React to what others have said if relevant. Keep it under 150 words.
`.trim()

  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    max_tokens: 250,
    temperature: 0.8,
    messages: [
      { role: "system", content: agent.systemPrompt },
      { role: "user", content: userContent },
    ],
  })

  return completion.choices[0].message.content || ""
}

export async function POST(req: NextRequest) {
  try {
    const { topic, sessionId, context, agentIds } = await req.json()

    // ── New session ──────────────────────────────────────────────
    if (!sessionId) {
      if (!topic?.trim()) {
        return NextResponse.json({ error: "topic is required to start a meeting" }, { status: 400 })
      }

      const { data: session, error } = await supabase
        .from("meeting_sessions")
        .insert({ topic, status: "active" })
        .select("id")
        .single()

      if (error || !session) {
        return NextResponse.json({ error: "Failed to create meeting session" }, { status: 500 })
      }

      return NextResponse.json({ sessionId: session.id, topic, status: "created" })
    }

    // ── Continue existing session ────────────────────────────────
    // Load session
    const { data: session } = await supabase
      .from("meeting_sessions")
      .select("*")
      .eq("id", sessionId)
      .single()

    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 })
    }

    const meetingTopic = session.topic as string

    // Load existing messages
    const { data: existingMessages } = await supabase
      .from("meeting_messages")
      .select("*")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: true })

    const thread: { agentName: string; content: string }[] =
      (existingMessages || []).map((m: any) => ({
        agentName: m.agent_name,
        content: m.content,
      }))

    // Determine which agents to run this round
    const participatingIds: AgentId[] = (agentIds?.length
      ? agentIds.filter((id: string) => AGENT_MAP[id as AgentId])
      : MEETING_AGENTS) as AgentId[]

    // Run each agent sequentially — each sees all prior messages including earlier turns this round
    const newMessages: { agentId: AgentId; agentName: string; content: string }[] = []

    for (const agentId of participatingIds) {
      const fullThread = [
        ...thread,
        ...newMessages.map(m => ({ agentName: m.agentName, content: m.content })),
      ]

      const output = await runAgentTurn(agentId, meetingTopic, fullThread, context)
      const agentName = AGENT_MAP[agentId].name

      newMessages.push({ agentId, agentName, content: output })
    }

    // Save all new messages to DB
    if (newMessages.length > 0) {
      await supabase.from("meeting_messages").insert(
        newMessages.map(m => ({
          session_id: sessionId,
          agent_id: m.agentId,
          agent_name: m.agentName,
          content: m.content,
        }))
      )
    }

    // Return full thread (existing + new)
    const fullThread = [
      ...(existingMessages || []).map((m: any) => ({
        agentId: m.agent_id,
        agentName: m.agent_name,
        content: m.content,
        createdAt: m.created_at,
      })),
      ...newMessages.map(m => ({
        agentId: m.agentId,
        agentName: m.agentName,
        content: m.content,
        createdAt: new Date().toISOString(),
      })),
    ]

    return NextResponse.json({
      sessionId,
      topic: meetingTopic,
      messages: fullThread,
      newCount: newMessages.length,
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
