import { NextRequest, NextResponse } from "next/server"
import OpenAI from "openai"
import { supabase } from "@/lib/supabase"
import { AGENT_MAP } from "@/lib/agents"

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
const agent = AGENT_MAP.khalid

export async function POST(req: NextRequest) {
  try {
    const {
      screenshotDescription, // text description of what's visible in the footage/screenshots
      footageContext,         // optional: { title, location, tags, duration, filmDate } from FootageVault
      dialect = "jordanian",
      targetDuration = 30,   // seconds
      sessionId,
    } = await req.json()

    if (!screenshotDescription?.trim() && !footageContext) {
      return NextResponse.json({ error: "screenshotDescription or footageContext is required" }, { status: 400 })
    }

    // Build footage context block
    const footageBlock = footageContext
      ? `Footage metadata:
- Title: ${footageContext.title || "untitled"}
- Location: ${footageContext.location || "unknown"}
- Tags: ${footageContext.tags?.join(", ") || "none"}
- Duration: ${footageContext.duration ? `${footageContext.duration}s` : "unknown"}
- Film date: ${footageContext.filmDate || "unknown"}`
      : ""

    const userContent = `
Visual content description:
${screenshotDescription || "(no description — use footage metadata only)"}

${footageBlock}

Target voiceover duration: ~${targetDuration} seconds
Dialect: ${dialect === "jordanian" ? "Jordanian Arabic (عامية أردنية)" : dialect === "fusha" ? "Modern Standard Arabic (فصحى)" : "Mixed"}

Write a complete voiceover script that matches this specific footage.
Do NOT describe what's visible — the narration must ADD what the image can't show.
If the description is too vague to write specific narration, flag it clearly before attempting.

Deliver:
1. SCENE BREAKDOWN — each scene/moment with:
   - Timestamp suggestion (e.g. 0:00–0:03)
   - Narration text (Arabic)
   - Transliteration
   - Tone note (e.g. "build energy", "pause here", "whisper")
2. FULL SCRIPT (clean read-through, Arabic)
3. PACING NOTES — where to speed up, slow down, or stay silent
4. REJECTION NOTE (if you can't write specific narration from this description, say so)
`.trim()

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      max_tokens: 800,
      temperature: 0.75,
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
