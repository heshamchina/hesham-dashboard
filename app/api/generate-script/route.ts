import { NextRequest, NextResponse } from "next/server"
import OpenAI from "openai"

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

export async function POST(req: NextRequest) {
  try {
    const { series, vibe, topic, language = "ar", tone = "jordanian", duration = 60, enrichment = null } = await req.json()

    const SERIES_CONTEXT: Record<string, string> = {
      "city-series":    "جولة في مدينة صينية من منظور عربي مسلم — أكل حلال، أماكن مخفية، نصائح عملية، ما لا يعرفه السياح",
      "chinese-brands": "ماركات صينية مجهولة في العالم العربي لكنها تستحق — جودة، سعر، أين تشتريها",
      "shopping":       "أسواق الجملة والتسوق بالصين — نصائح للمشترين العرب، أين تروح، كيف تتفاوض، كيف تتجنب الغلط",
      "food-halal":     "الأكل الحلال بالصين — وين تلاقيه، إيش تطلب، مطاعم الإيغور والمسلمين، تجارب حقيقية",
      "advice":         "نصائح عملية للعرب بالصين أو اللي بدهم يجوا — أعمال، سفر، حياة يومية، أخطاء شائعة",
      "behind-scenes":  "يوم من حياتي كأردني يشتغل بالصين — الحقيقة مش الفلتر",
      "other":          "محتوى عام عن الصين من منظور عربي داخلي",
    }

    const VIBE_GUIDE: Record<string, string> = {
      viral:           "ابدأ بمعلومة صادمة أو سؤال ما توقعته. خلي المشاهد يحس إنه لازم يكمل. استخدم الفضول والمفاجأة.",
      storytelling:    "ابدأ بلحظة حقيقية من حياتك. بني توتر وحل. الناس تتعلق بالقصص مش بالمعلومات.",
      informative:     "ابدأ بسؤال أو رقم غريب. قدم معلومات منظمة وواضحة. تعليمي بس ما يكون ممل.",
      advice:          "ابدأ بمشكلة يعيشها المشاهد. قدم حل عملي من تجربتك الشخصية. ما في نظريات.",
      "behind-scenes": "خام وحقيقي. ما في تمثيل. اللي بصير فعلاً في يوم شغل عادي.",
      "series-episode":"اربط بالحلقات السابقة باختصار. قدم جديد. خلي المشاهد يترقب الجاي.",
    }

    const TONE_GUIDE: Record<string, string> = {
      jordanian: `اللهجة الأردنية الأصيلة. طبيعي ومباشر. استخدم تعابير زي "تعالوا أقلكم"، "أنا عايش بالصين سبع سنين"، "هاد شي ما بعرفوا كثير ناس"، "بصراحة"، "والله". ما تكون رسمي أو سطحي. حكي زي ما تحكي لصاحبك.`,
      msa:       `عربي فصيح مبسط. واضح ومباشر. بدون تعقيد. مناسب لكل العرب.`,
      mixed:     `مزيج بين الأردنية والفصحى — الهوك والـ CTA بالأردنية الطبيعية، الشرح والمعلومات بفصحى مبسطة. أسلوب احترافي ومحبوب.`,
      english:   `English. Casual, direct, conversational. No corporate speak. Talk like a friend who actually knows China.`,
    }

    const isArabic = language === "ar"
    const langKey = isArabic ? (tone || "jordanian") : "english"
    const toneGuide = TONE_GUIDE[langKey] || TONE_GUIDE.jordanian

    const durationGuide = duration <= 30
      ? "فيديو قصير 15-30 ثانية: هوك + نقطة واحدة قوية + CTA مباشر"
      : duration <= 60
        ? "ريلز 60 ثانية: هوك + 3 نقاط رئيسية + CTA"
        : "فيديو طويل 90 ثانية: هوك + 5 نقاط تفصيلية + CTA + تيزر للجاي"

    const systemPrompt = `أنت كاتب محتوى احترافي متخصص في الريلز العربية عن الصين.

هويتك: تكتب لـ @heshaminchina — أردني عايش بالصين 7+ سنوات، زار أكثر من 80 مدينة صينية، عنده أكثر من 32 ألف متابع على إنستغرام. محتواه للعرب اللي عندهم فضول عن الصين أو الشغل منها.

قواعد كتابة السكريبت عندك:
1. **الهوك يصنع أو يكسر الفيديو** — ثلاث ثوان الأولى لازم تضرب. استخدم: صدمة، سؤال غير متوقع، رقم مذهل، أو جملة تخلي الواحد يسأل "ليش؟"
2. **قاعدة الـ AIDA**: Attention → Interest → Desire → Action
3. **ما في حشو**: كل جملة لها معنى. إذا شلتها وما أثر — اشلها.
4. **الأرقام والتفاصيل** تبني مصداقية: "80+ مدينة"، "7 سنوات"، "2 دولار فقط"
5. **الانتقالات** بين النقاط لازم تكون سلسة وطبيعية
6. **CTA** مش بس "اشترك" — خليه نفسي مرتبط بالمحتوى
7. **التوقيت** مضبوط: كل جملة بتعرف كم ثانية تاخذ
8. **اللهجة** ثابتة من أول لآخر — ما تخلط
9. **ما تنسى**: المشاهد ما يعرف Hesham — كل فيديو مستقل بحالو
10. **نقاط الإيقاع**: استخدم "أول شي"، "ثاني شي"، "وأهم شي" لتنظيم الجسم

سلسلة المحتوى: ${series} — ${SERIES_CONTEXT[series] || "محتوى صيني عربي"}
نوع الفيديو: ${vibe} — ${VIBE_GUIDE[vibe] || ""}
الموضوع: ${topic}
اللهجة: ${toneGuide}
المدة: ${durationGuide}`

    // Build enrichment context block
    let enrichmentBlock = ""
    if (enrichment) {
      const lines: string[] = []

      if (enrichment.wiki?.summary) {
        lines.push(`=== ويكيبيديا ===\n${enrichment.wiki.summary}`)
      }
      if (enrichment.coords?.province) {
        lines.push(`الموقع: ${enrichment.coords.province}، الصين`)
      }

      // Prefer synthesized (GPT-structured from all sources) over raw OSM
      const syn = enrichment.synthesized
      if (syn) {
        if (syn.topAttractions?.length)
          lines.push(`أبرز المعالم السياحية:\n${syn.topAttractions.map((a: any) => `- ${a.name}: ${a.description}`).join("\n")}`)
        if (syn.natureLandscapes?.length)
          lines.push(`المناظر الطبيعية والجبال:\n${syn.natureLandscapes.map((n: any) => `- ${n.name}: ${n.description}`).join("\n")}`)
        if (syn.activities?.length)
          lines.push(`الأنشطة والتجارب:\n${syn.activities.map((a: any) => `- ${a.name}: ${a.description}`).join("\n")}`)
        if (syn.foodAndHalal?.length)
          lines.push(`الأكل والمطاعم الحلال:\n${syn.foodAndHalal.map((f: any) => `- ${f.name} (${f.type}): ${f.note}`).join("\n")}`)
        if (syn.shopping?.length)
          lines.push(`التسوق والأسواق:\n${syn.shopping.map((s: any) => `- ${s.name}: ${s.note}`).join("\n")}`)
        if (syn.hiddenGems?.length)
          lines.push(`أماكن مخفية وغير معروفة:\n${syn.hiddenGems.map((g: any) => `- ${g.name}: ${g.why}`).join("\n")}`)
        if (syn.whatPeopleSay?.length)
          lines.push(`ماذا يقول المسافرون:\n${syn.whatPeopleSay.map((q: string) => `- "${q}"`).join("\n")}`)
        if (syn.practicalTips?.length)
          lines.push(`نصائح عملية: ${syn.practicalTips.join(" | ")}`)
        if (syn.arabAngle)
          lines.push(`الزاوية للمسافر العربي المسلم: ${syn.arabAngle}`)
      } else if (enrichment.pois) {
        // Fallback to raw OSM
        const p = enrichment.pois
        if (p.attractions?.length)  lines.push(`أماكن سياحية: ${p.attractions.join("، ")}`)
        if (p.nature?.length)       lines.push(`طبيعة وجبال وكهوف: ${p.nature.join("، ")}`)
        if (p.activities?.length)   lines.push(`أنشطة: ${p.activities.join("، ")}`)
        if (p.halal?.length)        lines.push(`مطاعم حلال: ${p.halal.join("، ")}`)
        if (p.markets?.length)      lines.push(`أسواق: ${p.markets.join("، ")}`)
        if (p.villages?.length)     lines.push(`قرى تقليدية: ${p.villages.join("، ")}`)
      }

      if (lines.length > 0) {
        enrichmentBlock = `\n\n=== بيانات حقيقية من مصادر متعددة (GetYourGuide, TripAdvisor, ChinaHighlights, مافنغوو, ويكيبيديا, OpenStreetMap) ===\n${lines.join("\n\n")}\n\n===\nمهم جداً: استخدم هذه الأماكن والمعلومات الحقيقية في السكريبت. ذكر أسماء الأماكن بالتحديد. اذكر على الأقل 4-6 أماكن أو تجارب محددة من القائمة أعلاه لتكون المعلومات مفيدة وموثوقة للمشاهد.\n`
      }
    }

    const userPrompt = `اكتب سكريبت ريلز كامل واحترافي عن: "${topic}"${enrichmentBlock}

أعطني الرد بالشكل التالي (JSON فقط، بدون markdown):
{
  "hook": "جملة الهوك (0-3 ثوان) — الجملة الأولى اللي بتوقف التمرير",
  "hookAlternatives": ["هوك بديل 1", "هوك بديل 2"],
  "body": "جسم السكريبت الكامل مع الانتقالات والتوقيتات — فقرات واضحة",
  "cta": "الـ CTA النهائي",
  "keywordHashtags": ["#هاشتاق1", "#هاشتاق2", "#هاشتاق3", "#هاشتاق4", "#هاشتاق5"],
  "caption": "كابشن إنستغرام جاهز للنشر مع إيموجيات",
  "filmingTips": ["نصيحة تصوير 1", "نصيحة تصوير 2"],
  "estimatedDuration": "X ثانية",
  "viralPotential": "ليش هالسكريبت يمكن ينتشر"
}`

    const res = await openai.chat.completions.create({
      model: "gpt-4o",
      max_tokens: 1500,
      temperature: 0.8,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ]
    })

    const text = res.choices[0].message.content || "{}"
    const parsed = JSON.parse(text.replace(/```json|```/g, "").trim())
    return NextResponse.json(parsed)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
