const {
  mergeConfig,
  resolveState,
  updateHormones,
  callAnalyze,
  callAppChat,
  getCognitiveMode,
} = require("./runtime.cjs")

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
      validActions: parseJson(vars.validActionsJson, DEFAULT_ACTIONS),
      actionOutcomes: parseJson(vars.actionOutcomesJson, {}),
      confidenceMin: typeof vars.confidenceMin === "number" ? vars.confidenceMin : 0,
      confidenceMax: typeof vars.confidenceMax === "number" ? vars.confidenceMax : 1,
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

module.exports = class NellmDecisionProvider {
  id() {
    return "nellm-decision"
  }

  async callApi(prompt, context) {
    const vars = (context && context.vars) || {}
    const config = mergeConfig(vars.config)
    const turns = parseTurns(vars, prompt)

    let state = resolveState(vars)
    const results = []

    for (let index = 0; index < turns.length; index += 1) {
      const turn = turns[index]
      const allowedActions = Array.isArray(turn.allowedActions) && turn.allowedActions.length > 0 ? turn.allowedActions : DEFAULT_ACTIONS
      const history = summarizeHistory(results)

      const sensory = await callAnalyze(String(turn.scenario || prompt || ""), config)
      state = updateHormones(state, sensory, config)

      const result = await callAppChat(buildDecisionPrompt(turn, history, allowedActions), state, config)
      const normalized = normalizeDecision(result.output, allowedActions)

      results.push({
        turn: index + 1,
        ...normalized,
        mode: getCognitiveMode(state),
        state,
        sensory,
      })
    }

    return {
      output: JSON.stringify({
        scenario: vars.scenario || prompt,
        turns: results.map(({ turn, action, confidence, reason, mode, state }) => ({
          turn,
          action,
          confidence,
          reason,
          mode,
          state: {
            cortisol: Number(state.cortisol.toFixed(3)),
            oxytocin: Number(state.oxytocin.toFixed(3)),
            dopamine: Number(state.dopamine.toFixed(3)),
            sustainedStressDuration: Number((state.sustainedStressDuration || 0).toFixed(3)),
          },
        })),
      }),
      metadata: {
        turns: results,
      },
    }
  }
}
