import { NextRequest, NextResponse } from "next/server"
import OpenAI from "openai"
import { supabase } from "@/lib/supabase"
import { AGENT_MAP } from "@/lib/agents"

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
const agent = AGENT_MAP.nour

export async function POST(req: NextRequest) {
  try {
    const { city, sessionId } = await req.json()

    if (!city?.trim()) {
      return NextResponse.json({ error: "city is required" }, { status: 400 })
    }

    // Call the existing enrich-topic endpoint internally to gather raw data
    let rawData: any = null
    try {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
      const enrichRes = await fetch(`${baseUrl}/api/enrich-topic`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: city }),
        signal: AbortSignal.timeout(45000),
      })
      if (enrichRes.ok) {
        rawData = await enrichRes.json()
      }
    } catch {}

    // Build the research brief for Nour to synthesize
    const parts: string[] = []

    if (rawData?.wiki?.summary) {
      parts.push(`WIKIPEDIA:\n${rawData.wiki.summary}`)
    }
    if (rawData?.pois) {
      const p = rawData.pois
      if (p.attractions?.length)  parts.push(`ATTRACTIONS (OSM): ${p.attractions.join(", ")}`)
      if (p.nature?.length)       parts.push(`NATURE (OSM): ${p.nature.join(", ")}`)
      if (p.activities?.length)   parts.push(`ACTIVITIES (OSM): ${p.activities.join(", ")}`)
      if (p.halal?.length)        parts.push(`HALAL FOOD (OSM): ${p.halal.join(", ")}`)
      if (p.restaurants?.length)  parts.push(`RESTAURANTS (OSM): ${p.restaurants.slice(0, 8).join(", ")}`)
      if (p.markets?.length)      parts.push(`MARKETS/SHOPPING (OSM): ${p.markets.join(", ")}`)
      if (p.villages?.length)     parts.push(`VILLAGES (OSM): ${p.villages.join(", ")}`)
    }
    if (rawData?.synthesized) {
      parts.push(`GPT PRE-SYNTHESIS:\n${JSON.stringify(rawData.synthesized, null, 2)}`)
    }
    if (rawData?.sourceLabels?.length) {
      parts.push(`Sources fetched: ${rawData.sourceLabels.join(", ")}`)
    }

    const dataQuality = parts.length === 0
      ? "WARNING: No research data available — reason from knowledge but flag everything as unverified."
      : `Data from ${parts.length} source blocks.`

    const userContent = `
Research target: "${city}" (China)
${dataQuality}

${parts.join("\n\n")}

Synthesize this into a complete destination intelligence brief for @heshaminchina.
Structure:
1. TL;DR — what is this place, is it worth visiting, for what type of traveler
2. Top attractions (with source attribution, flag single-source items)
3. Hidden gems or underrated experiences
4. Halal food & Muslim-friendly notes (be specific — don't say "options available" without naming them)
5. Content opportunities — what will visually pop, what story angles work for Arab audiences
6. Practical tips that actually matter (transport, best season, avoid X)
7. Data gaps — what you couldn't find, what needs verification on-ground

Be honest about data quality. "Thin data" is a valid assessment.
`.trim()

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      max_tokens: 1000,
      temperature: 0.4,
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

    return NextResponse.json({
      output,
      taskId: task?.id || null,
      rawData: rawData || null,
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
