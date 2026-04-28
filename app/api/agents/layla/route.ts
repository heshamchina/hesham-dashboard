import { NextRequest, NextResponse } from "next/server"
import OpenAI from "openai"
import { supabase } from "@/lib/supabase"
import { AGENT_MAP } from "@/lib/agents"

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
const agent = AGENT_MAP.layla

export async function POST(req: NextRequest) {
  try {
    const {
      topic,
      series,         // e.g. "Beijing Hidden Gems", "Market Guides"
      vibe,           // e.g. "energetic", "cinematic", "informative", "funny"
      dialect = "jordanian", // "jordanian" | "fusha" | "mixed"
      duration = 30,  // seconds
      sessionId,
    } = await req.json()

    if (!topic?.trim()) {
      return NextResponse.json({ error: "topic is required" }, { status: 400 })
    }

    const userContent = `
Write a complete Instagram reel script for this topic: "${topic}"
${series ? `This is part of the series: "${series}"` : ""}
Dialect: ${dialect === "jordanian" ? "Jordanian Arabic (عامية أردنية)" : dialect === "fusha" ? "Modern Standard Arabic (فصحى)" : "Mixed — Jordanian with Fusha terms for key concepts"}
Target duration: ~${duration} seconds
Vibe/tone: ${vibe || "conversational, engaging"}

Deliver:
1. HOOK (first 3 seconds) — must create curiosity gap or pattern interrupt, NO "today I'll show you"
2. BODY (scene breakdown with timing)
3. CTA (last 3-5 seconds)
4. CAPTION (Arabic, 150-200 chars)
5. HASHTAGS (10-15, mix Arabic + English)
6. THUMBNAIL/COVER TEXT suggestion

If the topic is weak or overdone, flag it first and suggest a sharper angle before writing.
`.trim()

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      max_tokens: 900,
      temperature: 0.85,
      messages: [
        { role: "system", content: agent.systemPrompt },
        { role: "user", content: userContent },
      ],
    })

    const output = completion.choices[0].message.content || ""

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
