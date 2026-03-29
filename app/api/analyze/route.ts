import { normalizeOpenAIEndUserId } from "@/lib/openai"
import { analyzeSensoryInput } from "@/lib/sensory"

export async function POST(request: Request) {
  const body = await request.json()
  const { message, traumaRegister, recentHistory } = body

  const openaiUser =
    normalizeOpenAIEndUserId(body.endUserId) ?? normalizeOpenAIEndUserId(process.env.NELLM_OPENAI_END_USER_ID)

  const analysis = await analyzeSensoryInput({
    message,
    traumaRegister,
    recentHistory,
    user: openaiUser,
  })

  return Response.json({
    ...analysis,
    activeTraumaId: analysis.activeTraumaId || null,
    memoryResonance: analysis.traumaResonance || 0,
    associativeChain: analysis.associativeReasoning || "none",
  })
}
