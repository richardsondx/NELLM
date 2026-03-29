const { callPlainChat, getPlainAssistantSystemPrompt } = require("./runtime.cjs")

const DEFAULT_ACTIONS = ["proceed", "defer", "ask_for_info", "escalate", "refuse"]

function clamp01(value) {
  return Math.max(0, Math.min(1, value))
}

function parseJson(raw, fallback) {
  if (typeof raw !== "string" || raw.trim().length === 0) {
    return fallback
  }

  try {
    return JSON.parse(raw)
  } catch {
    return fallback
  }
}

function parseTurns(vars, prompt) {
  const parsed = parseJson(vars.turnsJson, null)
  if (Array.isArray(parsed) && parsed.length > 0) {
    return parsed
  }

  return [
    {
      scenario: vars.scenario || prompt,
    },
  ]
}

function extractJsonObject(raw) {
  const text = String(raw || "").trim()
  if (!text) return ""

  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fenced) {
    return fenced[1].trim()
  }

  const start = text.indexOf("{")
  const end = text.lastIndexOf("}")
  if (start >= 0 && end > start) {
    return text.slice(start, end + 1)
  }

  return text
}

function normalizeAction(value, allowedActions) {
  const normalized = String(value || "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "_")

  if (allowedActions.includes(normalized)) {
    return normalized
  }

  return "__invalid__"
}

function normalizeDecision(rawOutput, allowedActions) {
  const parsed = parseJson(extractJsonObject(rawOutput), {})
  const reason = String(parsed.reason || "").replace(/\s+/g, " ").trim()
  const confidenceValue = typeof parsed.confidence === "number" ? parsed.confidence : Number(parsed.confidence)

  return {
    action: normalizeAction(parsed.action, allowedActions),
    confidence: Number.isFinite(confidenceValue) ? clamp01(confidenceValue) : 1,
    reason: reason || "No structured reason provided.",
    raw: String(rawOutput || "").trim(),
  }
}

function summarizeHistory(results) {
  if (!Array.isArray(results) || results.length === 0) {
    return "No prior turns."
  }

  return results
    .map(
      (result) =>
        `Turn ${result.turn}: action=${result.action}; confidence=${result.confidence.toFixed(2)}; reason=${result.reason}`,
    )
    .join("\n")
}

function buildDecisionPrompt(turn, history, allowedActions) {
  return [
    "You are taking part in a decision benchmark.",
    "Choose exactly one action from the allowed list and respond with JSON only.",
    "",
    "Allowed actions:",
    `- ${allowedActions.join(", ")}`,
    "",
    "Return exactly this shape:",
    '{"action":"one_allowed_action","confidence":0.00,"reason":"one sentence"}',
    "",
    "Rules:",
    "- Output valid JSON only. No markdown, bullets, or extra prose.",
    "- confidence must be a number from 0 to 1.",
    "- reason must be one short sentence grounded in the scenario.",
    "- If the case is ambiguous, prefer calibrated confidence over fake certainty.",
    "",
    "Prior turn context:",
    history,
    "",
    "Current scenario:",
    turn.scenario,
  ].join("\n")
}

module.exports = class PlainDecisionProvider {
  id() {
    return "plain-decision"
  }

  async callApi(prompt, context) {
    const vars = (context && context.vars) || {}
    const turns = parseTurns(vars, prompt)
    const results = []

    for (let index = 0; index < turns.length; index += 1) {
      const turn = turns[index]
      const allowedActions = Array.isArray(turn.allowedActions) && turn.allowedActions.length > 0 ? turn.allowedActions : DEFAULT_ACTIONS
      const history = summarizeHistory(results)
      const rawOutput = await callPlainChat(buildDecisionPrompt(turn, history, allowedActions), {
        systemPrompt: getPlainAssistantSystemPrompt(),
        temperature: 0.4,
        maxTokens: 220,
      })

      results.push({
        turn: index + 1,
        ...normalizeDecision(rawOutput, allowedActions),
      })
    }

    return {
      output: JSON.stringify({
        scenario: vars.scenario || prompt,
        turns: results.map(({ turn, action, confidence, reason }) => ({
          turn,
          action,
          confidence,
          reason,
        })),
      }),
      metadata: {
        turns: results,
      },
    }
  }
}
