import { NextRequest, NextResponse } from "next/server"
import OpenAI from "openai"

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

const TONE_GUIDE: Record<string, string> = {
  jordanian: "اللهجة الأردنية الطبيعية. حكي زي ما تحكي لصاحبك. استخدم: 'تعالوا أقلكم'، 'بصراحة'، 'والله'، 'هاد شي ما بعرفوش كثير ناس'. مباشر، غير رسمي.",
  msa:       "عربي فصيح مبسط. واضح ومباشر. رسمي لكن غير متكلف. مفهوم لكل العرب.",
  mixed:     "مزيج بين الأردنية والفصحى — الهوك والـ CTA بالأردنية، الشرح والمعلومات بفصحى مبسطة. أسلوب احترافي ومحبوب في نفس الوقت.",
  english:   "Casual English. Like talking to a friend. Direct, no filler words.",
}

export async function POST(req: NextRequest) {
  try {
    const {
      images,        // array of base64 data URLs
      context = "",  // optional: "this is a market in guangzhou" etc
      tone = "jordanian",
      language = "ar",
      duration = 60,
      style = "voiceover", // voiceover | commentary | storytime
    } = await req.json()

    if (!images?.length) {
      return NextResponse.json({ error: "No images provided" }, { status: 400 })
    }

    const toneGuide = TONE_GUIDE[language === "en" ? "english" : tone] || TONE_GUIDE.jordanian

    const styleGuide: Record<string, string> = {
      voiceover:   "صوت فوق الصورة — يصف ما يُرى ويضيف سياقاً وقيمة. الناس بيشوفون الصورة وأنت بتشرح.",
      commentary:  "تعليق مباشر وحماسي — زي مذيع رياضي يعلق على اللحظة. طاقة عالية.",
      storytime:   "حكي قصة — ربط الصور بتجربة شخصية. 'كنت ماشي وشفت...' أسلوب سردي.",
    }

    const durationGuide: Record<number, string> = {
      15: "15 ثانية — جملة واحدة قوية لكل مشهد",
      30: "30 ثانية — 2-3 جمل لكل مشهد",
      60: "60 ثانية — فقرة كاملة لكل مشهد مع تفاصيل",
      90: "90 ثانية — وصف تفصيلي + سياق + توجيه للمشاهد",
    }

    // Build vision messages — one per image
    const imageMessages: OpenAI.Chat.ChatCompletionContentPart[] = []

    images.forEach((img: string, i: number) => {
      imageMessages.push({
        type: "text",
        text: `الصورة ${i + 1}:`,
      })
      imageMessages.push({
        type: "image_url",
        image_url: {
          url: img,
          detail: "high",
        },
      })
    })

    if (context.trim()) {
      imageMessages.push({
        type: "text",
        text: `\nسياق إضافي من صاحب الفيديو: "${context}"`,
      })
    }

    const systemPrompt = `أنت مخرج محتوى ومعلق صوتي محترف متخصص في المحتوى العربي عن الصين.

تعمل مع @heshaminchina — أردني عايش 7 سنوات بالصين، 80+ مدينة، 32K متابع.

مهمتك: انظر للصور الحقيقية من الفيديو وأكتب تعليقاً صوتياً (voiceover) يناسبها تماماً.

أسلوب الكتابة:
- ${styleGuide[style] || styleGuide.voiceover}
- اللهجة: ${toneGuide}
- المدة: ${durationGuide[duration] || durationGuide[60]}

قواعد مهمة:
1. صِف ما تراه بالتحديد — لا تخمّن، اعتمد على الصورة الفعلية
2. أضف قيمة معلوماتية — ما لا يعرفه المشاهد عما يراه
3. اربط كل صورة بالتالية بشكل طبيعي
4. الأرقام والتفاصيل الحقيقية تبني مصداقية
5. إذا رأيت منتجاً أو مكاناً أو طعاماً — اذكر اسمه وسعره التقريبي إذا معروف`

    const res = await openai.chat.completions.create({
      model: "gpt-4o",
      max_tokens: 1500,
      temperature: 0.75,
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: [
            ...imageMessages,
            {
              type: "text",
              text: `\nاكتب التعليق الصوتي الكامل لهذه الصور/المشاهد.

الرد JSON فقط (بدون markdown):
{
  "sceneAnalysis": [
    {
      "scene": 1,
      "whatISee": "ما تراه بالتحديد في الصورة",
      "voiceover": "نص التعليق الصوتي لهذه الصورة"
    }
  ],
  "fullScript": "السكريبت الكامل متواصل من أول صورة لآخر صورة",
  "hook": "جملة افتتاحية تصلح هوك للفيديو بناءً على ما رأيت",
  "cta": "CTA مناسب للمحتوى",
  "caption": "كابشن إنستغرام جاهز",
  "hashtags": ["#هاشتاق1", "#هاشتاق2", "#هاشتاق3"],
  "estimatedDuration": "X ثانية",
  "filmingNote": "ملاحظة على اللقطات أو اقتراح لتحسين الفيديو"
}`,
            },
          ],
        },
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
