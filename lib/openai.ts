interface ChatMessage {
  role: "system" | "user" | "assistant"
  content: string
}

interface OpenAIUserPayload {
  /**
   * End-user / job id for OpenAI abuse monitoring: Chat Completions `user`, Responses `safety_identifier`.
   * Use a stable id per real end-user or per eval job — not raw PII.
   */
  user?: string
}

interface ChatCompletionOptions extends OpenAIUserPayload {
  model: string
  messages: ChatMessage[]
  temperature?: number
  maxTokens?: number
  responseFormat?: { type: "json_object" }
}

/** Matches Responses API `safety_identifier` max length; safe for Chat Completions `user` too. */
const OPENAI_END_USER_MAX_LEN = 64

/** Normalize values for Chat Completions `user` and Responses `safety_identifier`. */
export function normalizeOpenAIEndUserId(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined
  const trimmed = value.trim()
  if (!trimmed) return undefined
  const stripped = trimmed.replace(/[\u0000-\u001f\u007f]/g, "")
  if (!stripped) return undefined
  return stripped.slice(0, OPENAI_END_USER_MAX_LEN)
}

function openAIUserForRequest(options: OpenAIUserPayload): string | undefined {
  return normalizeOpenAIEndUserId(options.user)
}

/** GPT-5 family models use the Responses API; Chat Completions often return empty text for them. */
function usesOpenAIResponsesApi(model: string): boolean {
  return /^gpt-5/i.test(model)
}

/** Several GPT-5-class models reject `temperature` entirely on the Responses API (not only non-default values). */
function responsesApiAllowsTemperature(model: string): boolean {
  return !/^gpt-5/i.test(model)
}

function getOpenAIHeaders(): Record<string, string> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is required")
  }

  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
  }
}

function responsesOutputBudget(maxTokens?: number): number {
  const base = typeof maxTokens === "number" ? maxTokens : 1024
  // Reasoning models charge visible + reasoning against the same cap; leave headroom.
  return Math.min(32768, Math.max(base + 12000, 4096))
}

/** Responses API requires the word "json" somewhere in input when using `json_object` output format. */
function ensureResponsesInputMentionsJson(input: ChatMessage[]): ChatMessage[] {
  const blob = input.map((m) => m.content).join("\n")
  if (/\bjson\b/i.test(blob)) {
    return input
  }

  const hint = "\n\nRespond with valid JSON only: output one JSON object and nothing else."
  const next = input.map((m) => ({ ...m }))
  for (let i = next.length - 1; i >= 0; i--) {
    if (next[i].role === "user") {
      next[i] = { ...next[i], content: next[i].content + hint }
      return next
    }
  }
  if (next.length > 0) {
    const i = next.length - 1
    next[i] = { ...next[i], content: next[i].content + hint }
  }
  return next
}

function extractResponsesOutputText(data: Record<string, unknown>): string {
  const direct = data.output_text
  if (typeof direct === "string" && direct.length > 0) return direct

  const output = data.output
  if (!Array.isArray(output)) return ""

  const parts: string[] = []
  for (const item of output) {
    if (!item || typeof item !== "object") continue
    const row = item as Record<string, unknown>
    if (row.type === "message" && Array.isArray(row.content)) {
      for (const part of row.content) {
        if (!part || typeof part !== "object") continue
        const block = part as Record<string, unknown>
        if (block.type === "output_text" && typeof block.text === "string") {
          parts.push(block.text)
        }
      }
    }
  }
  return parts.join("")
}

async function createResponsesCompletion({
  model,
  messages,
  temperature,
  maxTokens,
  responseFormat,
  user,
}: ChatCompletionOptions): Promise<string> {
  const mapped: ChatMessage[] = messages.map((m) => ({
    role: m.role,
    content: m.content,
  }))
  const input = responseFormat?.type === "json_object" ? ensureResponsesInputMentionsJson(mapped) : mapped

  const body: Record<string, unknown> = {
    model,
    input,
    max_output_tokens: responsesOutputBudget(maxTokens),
  }

  if (responsesApiAllowsTemperature(model) && typeof temperature === "number") {
    body.temperature = temperature
  }

  if (responseFormat?.type === "json_object") {
    body.text = {
      format: { type: "json_object" },
    }
  }

  const safetyId = openAIUserForRequest({ user })
  if (safetyId) {
    body.safety_identifier = safetyId
  }

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: getOpenAIHeaders(),
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`OpenAI responses API failed (${response.status}): ${errorText}`)
  }

  const json = (await response.json()) as Record<string, unknown>
  return extractResponsesOutputText(json)
}

function usesMaxCompletionTokens(model: string): boolean {
  return /^gpt-5/i.test(model)
}

async function createChatCompletionsCompletion({
  model,
  messages,
  temperature,
  maxTokens,
  responseFormat,
  user,
}: ChatCompletionOptions): Promise<string> {
  const body: Record<string, unknown> = {
    model,
    messages,
    response_format: responseFormat,
  }

  const uid = openAIUserForRequest({ user })
  if (uid) {
    body.user = uid
  }

  if (!(usesMaxCompletionTokens(model) && typeof temperature === "number" && temperature !== 1)) {
    body.temperature = temperature
  }

  if (typeof maxTokens === "number") {
    if (usesMaxCompletionTokens(model)) {
      body.max_completion_tokens = maxTokens
    } else {
      body.max_tokens = maxTokens
    }
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: getOpenAIHeaders(),
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`OpenAI chat completion failed (${response.status}): ${errorText}`)
  }

  const json = (await response.json()) as {
    choices?: Array<{ message?: { content?: string | Array<{ text?: string } | string> } }>
  }
  const content = json.choices?.[0]?.message?.content

  if (typeof content === "string") {
    return content
  }

  if (Array.isArray(content)) {
    return content
      .map((item: unknown) => {
        if (typeof item === "string") return item
        if (item && typeof item === "object" && "text" in item && typeof (item as { text?: unknown }).text === "string") {
          return (item as { text: string }).text
        }
        return ""
      })
      .join("")
  }

  return ""
}

export async function createChatCompletion(options: ChatCompletionOptions): Promise<string> {
  if (usesOpenAIResponsesApi(options.model)) {
    return createResponsesCompletion(options)
  }
  return createChatCompletionsCompletion(options)
}
