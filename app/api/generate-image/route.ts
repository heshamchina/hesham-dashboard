import { NextRequest, NextResponse } from "next/server"
import OpenAI from "openai"
import fs from "fs"
import path from "path"

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

const SIZE_MAP: Record<string, "1024x1024" | "1024x1792" | "1792x1024"> = {
  "1:1":   "1024x1024",
  "9:16":  "1024x1792",
  "16:9":  "1792x1024",
  "4:5":   "1024x1024",
}

export async function POST(req: NextRequest) {
  try {
    const { prompt, format = "1:1", style = "vivid" } = await req.json()

    const size = SIZE_MAP[format] || "1024x1024"

    const enhancedPrompt = `${prompt}. Professional photography style, high quality, visually striking. No text or watermarks in the image.`

    const response = await openai.images.generate({
      model: "dall-e-3",
      prompt: enhancedPrompt,
      n: 1,
      size,
      style: style === "natural" ? "natural" : "vivid",
      response_format: "b64_json",
    })

    const imageB64 = response.data[0].b64_json
    const revisedPrompt = response.data[0].revised_prompt

    // Get logo as base64
    let logoB64 = ""
    try {
      const logoPath = path.join(process.cwd(), "public", "logo.png")
      if (fs.existsSync(logoPath)) {
        logoB64 = fs.readFileSync(logoPath).toString("base64")
      }
    } catch {}

    return NextResponse.json({
      image: `data:image/png;base64,${imageB64}`,
      logo: logoB64 ? `data:image/png;base64,${logoB64}` : null,
      revisedPrompt,
      format,
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
