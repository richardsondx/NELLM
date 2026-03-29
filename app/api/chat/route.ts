import {
  buildChatRuntimeConfig,
  buildProductionSystemPrompt,
  type HormoneState,
  type BioConfig,
} from "@/lib/hypothalamus"
import { createChatCompletion, normalizeOpenAIEndUserId } from "@/lib/openai"

export async function POST(request: Request) {
  try {
    const body = await request.json()

    const messages = body.messages || []
    const hormoneState = body.hormoneState as HormoneState
    const config = body.config as BioConfig | undefined

    const runtime = buildChatRuntimeConfig(hormoneState, config)
    const baseSystemPrompt = buildProductionSystemPrompt(hormoneState, config)

    const formattedMessages = messages.map((m: { role: string; content: string }) => ({
      role: m.role as "user" | "assistant" | "system",
      content: m.content,
    }))

    const openaiUser =
      normalizeOpenAIEndUserId(body.endUserId) ?? normalizeOpenAIEndUserId(process.env.NELLM_OPENAI_END_USER_ID)

    const content = await createChatCompletion({
      model: runtime.model,
      messages: [{ role: "system", content: baseSystemPrompt }, ...formattedMessages],
      temperature: runtime.temperature,
      maxTokens: runtime.maxTokens,
      user: openaiUser,
    })

    return new Response(content, {
      status: 200,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    })
  } catch (error) {
    console.error("Chat route error:", error)
    return new Response(JSON.stringify({ error: "Failed to process chat request" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    })
  }
}
