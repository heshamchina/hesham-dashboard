import { NextRequest, NextResponse } from "next/server"
import OpenAI from "openai"

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

export async function POST(req: NextRequest) {
  try {
    const { content } = await req.json()
    if (!content?.trim()) return NextResponse.json({ error: "No content provided" }, { status: 400 })

    const systemPrompt = `You are a content strategist for @heshaminchina — a Jordanian creator in Beijing with 32K Arabic Instagram followers. He makes content about life in China: cities, food, markets, travel, culture.

Your job: take ANY piece of content (caption, idea, hook, rough notes) and repurpose it into multiple ready-to-use formats.

Always write in Arabic (Jordanian dialect for conversational parts, clear Modern Standard Arabic for captions).
Keep the voice personal, engaging, and like someone talking to a friend.`

    const userPrompt = `Repurpose this content into multiple formats:

"${content}"

Return JSON only (no markdown):
{
  "hooks": [
    "Hook 1 — most attention-grabbing opening line (Arabic)",
    "Hook 2 — curiosity angle",
    "Hook 3 — question or surprise angle"
  ],
  "reelScript": "Shot-by-shot reel script for 30-60 seconds. Format each shot as: [SHOT X - duration] action/words. Write in Arabic. Keep it punchy and filmable.",
  "caption": "Full Instagram caption in Arabic with hook + body + CTA. 150-250 words. Engaging, personal tone.",
  "hashtags": ["#الصين", "#هشام_في_الصين", "... 8-12 relevant hashtags mix Arabic and English"],
  "storyText": "Short story slide text in Arabic — 2-3 slides max, casual and direct. Format as: SLIDE 1: ...\nSLIDE 2: ...",
  "shortVersion": "A short punchy version under 280 characters for X/Twitter. Arabic."
}`

    const res = await openai.chat.completions.create({
      model: "gpt-4o",
      max_tokens: 1800,
      temperature: 0.85,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    })

    const text = res.choices[0].message.content || "{}"
    const parsed = JSON.parse(text.replace(/```json|```/g, "").trim())
    return NextResponse.json(parsed)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
