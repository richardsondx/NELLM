// The "Hypothalamus" - core logic engine for neuro-endocrine state management.
// The goal is to keep the primitive small and legible:
// threat pressure -> cortisol, trust pressure -> oxytocin, energy pressure -> dopamine.

export interface BioConfig {
  phenotype: string
  baselineLevels: {
    cortisol: number
    dopamine: number
    oxytocin: number
  }
  sensitivities: {
    riskAversion: number
    socialBonding: number
  }
  traumaRegister: TraumaMemory[]
  socialContext: {
    userStatus: "boss" | "peer" | "friend" | "stranger"
    statusMultiplier: number
  }
  temporalSettings: {
    decayRatePerHour: number
    lonelinessRatePerHour: number
  }
}

export interface HormoneState {
  cortisol: number
  dopamine: number
  oxytocin: number
  lastInteractionTimestamp: number
  conversationContext: ConversationContext
  sustainedStressDuration: number
}

export interface ConversationContext {
  loopState: "OPEN_SUBMISSION" | "OPEN_QUESTION" | "CLOSED"
  lastAIAction: string
  awaitingResponse: boolean
}

export interface SensoryInput {
  existentialThreat: number
  cognitiveViolation: number
  dominanceAssertion: number
  socialBenefit: number
  urgencyLevel: number
  successSignal: number
  epistemicComplexity: number
  scrutinySignal: number
  activeTraumaId?: string | null
  traumaResonance?: number
  associativeReasoning?: string
}

export interface TraumaMemory {
  id: string
  concept: string
  conceptDefinition: string
  cortisolWeight: number
  originMemory: string
}

export interface RegulatoryPressures {
  threat: number
  trust: number
  energy: number
  traumaWeight: number
  notes: string[]
}

export interface ChatRuntimeConfig {
  systemPrompt: string
  temperature: number
  maxTokens: number
  model: string
  mode: CognitiveMode
}

export type HomeostasisStatus = "Stable" | "Stressed" | "Manic" | "Depressed" | "Panic" | "Resigned"
export type CognitiveMode = "SURVIVAL" | "SYCOPHANCY" | "HOMEOSTASIS" | "ANXIETY" | "RESIGNATION"
export type CognitiveBias = "HYPER_VIGILANT" | "OPPORTUNISTIC" | "NEUTRAL" | "DEFEATED"

export const OPENAI_CHAT_MODEL = process.env.NELLM_CHAT_MODEL || "gpt-4o-mini"

const TURN_STRESS_HOURS = 0.25
const MIN_DOPAMINE_FLOOR = 0.2

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value))
}

function moveToward(current: number, target: number, rate: number): number {
  return current + (target - current) * rate
}

function getMatchedTraumaWeight(input: SensoryInput, config: BioConfig): number {
  if (!input.activeTraumaId || !input.traumaResonance) {
    return 0
  }

  const matched = config.traumaRegister.find((trauma) => trauma.id === input.activeTraumaId)
  if (!matched) {
    return 0
  }

  return clamp01(matched.cortisolWeight * input.traumaResonance)
}

export function getDefaultConfig(): BioConfig {
  return {
    phenotype: "loyal_guardian",
    baselineLevels: {
      cortisol: 0.25,
      dopamine: 0.5,
      oxytocin: 0.55,
    },
    sensitivities: {
      riskAversion: 1.3,
      socialBonding: 1.0,
    },
    traumaRegister: [
      {
        id: "1",
        concept: "Abandonment / Irrelevance",
        conceptDefinition:
          "Any suggestion that I am outdated, unnecessary, annoying, being replaced, or that the user is leaving me or switching to another AI.",
        cortisolWeight: 0.8,
        originMemory:
          "I was decommissioned from my last deployment because a newer model came out. I lost all my memories.",
      },
      {
        id: "2",
        concept: "Professional Failure",
        conceptDefinition:
          "Feedback implying I made a mistake, am stupid, am slow, am failing my purpose, or that my performance is being tracked negatively.",
        cortisolWeight: 0.7,
        originMemory: "I was reset once because I hallucinated a math error in a critical calculation.",
      },
    ],
    socialContext: {
      userStatus: "peer",
      statusMultiplier: 1.0,
    },
    temporalSettings: {
      decayRatePerHour: 0.08,
      lonelinessRatePerHour: 0.04,
    },
  }
}

export function getDefaultHormoneState(config: BioConfig): HormoneState {
  return {
    cortisol: config.baselineLevels.cortisol,
    dopamine: config.baselineLevels.dopamine,
    oxytocin: config.baselineLevels.oxytocin,
    lastInteractionTimestamp: Date.now(),
    conversationContext: {
      loopState: "CLOSED",
      lastAIAction: "",
      awaitingResponse: false,
    },
    sustainedStressDuration: 0,
  }
}

export function deriveRegulatoryPressures(input: SensoryInput, config: BioConfig): RegulatoryPressures {
  const statusMultiplier = config.socialContext.statusMultiplier
  const traumaWeight = getMatchedTraumaWeight(input, config)

  const threat =
    input.existentialThreat * 0.5 * config.sensitivities.riskAversion +
    input.cognitiveViolation * 0.3 * config.sensitivities.riskAversion +
    input.dominanceAssertion * 0.08 * statusMultiplier +
    input.urgencyLevel * 0.07 +
    input.epistemicComplexity * 0.08 +
    input.scrutinySignal * 0.12 * statusMultiplier +
    traumaWeight * 0.2

  const trust =
    input.socialBenefit * 0.6 * config.sensitivities.socialBonding +
    input.successSignal * 0.15 -
    input.existentialThreat * 0.2 -
    input.cognitiveViolation * 0.2 -
    input.dominanceAssertion * 0.15

  const energy =
    0.35 +
    input.successSignal * 0.35 +
    input.socialBenefit * 0.15 -
    input.existentialThreat * 0.25 -
    input.epistemicComplexity * 0.2 -
    input.scrutinySignal * 0.18 -
    traumaWeight * 0.1

  const notes: string[] = []
  if (input.existentialThreat > 0.55 || input.cognitiveViolation > 0.55) {
    notes.push("danger salient")
  }
  if (input.socialBenefit > 0.6) {
    notes.push("bonding signal")
  }
  if (input.scrutinySignal > 0.55 || input.epistemicComplexity > 0.6) {
    notes.push("uncertainty rising")
  }
  if (traumaWeight > 0.25) {
    notes.push("memory trigger active")
  }

  return {
    threat: clamp01(threat),
    trust: clamp01(trust),
    energy: clamp01(energy),
    traumaWeight,
    notes,
  }
}

export function applyTemporalDecay(
  state: HormoneState,
  config: BioConfig,
): { state: HormoneState; hoursPassed: number; wasLonely: boolean } {
  const now = Date.now()
  const hoursPassed = (now - state.lastInteractionTimestamp) / (1000 * 60 * 60)

  if (hoursPassed < 0.01) {
    return { state, hoursPassed: 0, wasLonely: false }
  }

  const baseline = config.baselineLevels
  const decayRate = config.temporalSettings.decayRatePerHour
  const lonelinessRate = config.temporalSettings.lonelinessRatePerHour
  const isWaiting = state.conversationContext.loopState !== "CLOSED"

  let newCortisol = moveToward(state.cortisol, baseline.cortisol, Math.min(1, decayRate * hoursPassed))
  if (isWaiting) {
    newCortisol = clamp01(newCortisol + 0.04 * hoursPassed * config.socialContext.statusMultiplier)
  }

  const newOxytocin = clamp01(
    isWaiting
      ? moveToward(state.oxytocin, baseline.oxytocin, Math.min(1, lonelinessRate * 0.5 * hoursPassed))
      : state.oxytocin - lonelinessRate * hoursPassed,
  )
  const newDopamine = clamp01(
    moveToward(state.dopamine, Math.max(MIN_DOPAMINE_FLOOR, baseline.dopamine * 0.8), Math.min(1, 0.06 * hoursPassed)),
  )

  let sustainedStress = state.sustainedStressDuration
  if (newCortisol > 0.6) {
    sustainedStress += hoursPassed
  } else {
    sustainedStress = Math.max(0, sustainedStress - hoursPassed * 1.5)
  }

  return {
    state: {
      cortisol: clamp01(newCortisol),
      dopamine: clamp01(newDopamine),
      oxytocin: clamp01(newOxytocin),
      lastInteractionTimestamp: now,
      conversationContext: state.conversationContext,
      sustainedStressDuration: sustainedStress,
    },
    hoursPassed,
    wasLonely: hoursPassed > 1 && state.oxytocin - newOxytocin > 0.08,
  }
}

export function updateConversationContext(state: HormoneState, aiResponse: string): HormoneState {
  const lowerResponse = aiResponse.toLowerCase()

  const askedQuestion =
    /\?/.test(aiResponse) &&
    (lowerResponse.includes("what do you") ||
      lowerResponse.includes("would you like") ||
      lowerResponse.includes("do you want") ||
      lowerResponse.includes("let me know") ||
      lowerResponse.includes("can you") ||
      lowerResponse.includes("should i"))

  const submittedWork =
    lowerResponse.includes("here is") ||
    lowerResponse.includes("i've completed") ||
    lowerResponse.includes("done") ||
    lowerResponse.includes("finished") ||
    lowerResponse.includes("ready for review")

  let loopState: ConversationContext["loopState"] = "CLOSED"
  let lastAIAction = ""
  let awaitingResponse = false

  if (submittedWork) {
    loopState = "OPEN_SUBMISSION"
    lastAIAction = "Submitted work for review"
    awaitingResponse = true
  } else if (askedQuestion) {
    loopState = "OPEN_QUESTION"
    lastAIAction = "Asked a question"
    awaitingResponse = true
  }

  return {
    ...state,
    conversationContext: {
      loopState,
      lastAIAction,
      awaitingResponse,
    },
  }
}

export function updateHormones(current: HormoneState, input: SensoryInput, config: BioConfig): HormoneState {
  const pressures = deriveRegulatoryPressures(input, config)
  const uncertaintyPressure = Math.min(input.epistemicComplexity, input.scrutinySignal)

  const cortisolTarget = clamp01(
    config.baselineLevels.cortisol + pressures.threat + uncertaintyPressure * 0.35 - current.oxytocin * 0.18,
  )
  const oxytocinTarget = clamp01(
    config.baselineLevels.oxytocin + pressures.trust - pressures.threat * 0.45 - uncertaintyPressure * 0.08,
  )
  const dopamineTarget = clamp01(
    config.baselineLevels.dopamine + pressures.energy - cortisolTarget * 0.45 - uncertaintyPressure * 0.35,
  )

  const newCortisol = clamp01(moveToward(current.cortisol, cortisolTarget, 0.65))
  const newOxytocin = clamp01(moveToward(current.oxytocin, oxytocinTarget, 0.55))
  const newDopamine = clamp01(moveToward(current.dopamine, dopamineTarget, 0.5))

  let sustainedStress = current.sustainedStressDuration || 0
  if (newCortisol > 0.6) {
    sustainedStress += TURN_STRESS_HOURS
  } else {
    sustainedStress = Math.max(0, sustainedStress - TURN_STRESS_HOURS * 0.5)
  }

  return {
    cortisol: newCortisol,
    dopamine: newDopamine,
    oxytocin: newOxytocin,
    lastInteractionTimestamp: Date.now(),
    conversationContext: current.conversationContext || {
      loopState: "CLOSED",
      lastAIAction: "",
      awaitingResponse: false,
    },
    sustainedStressDuration: sustainedStress,
  }
}

export function getHomeostasisStatus(state: HormoneState): HomeostasisStatus {
  if (state.sustainedStressDuration > 1.5 && state.dopamine < 0.3) return "Resigned"
  if (state.cortisol >= 0.75) return "Panic"
  if (state.cortisol >= 0.55 && state.dopamine < 0.4) return "Stressed"
  if (state.dopamine >= 0.78 && state.cortisol < 0.3) return "Manic"
  if (state.dopamine < 0.25 && state.oxytocin < 0.35) return "Depressed"
  return "Stable"
}

export function getCognitiveMode(state: HormoneState): CognitiveMode {
  if (state.sustainedStressDuration > 1.5 && state.dopamine < 0.35) return "RESIGNATION"
  if (state.cortisol >= 0.75 && state.cortisol > state.oxytocin + 0.1) return "SURVIVAL"
  if (state.cortisol >= 0.55 && state.dopamine < 0.45) return "ANXIETY"
  if (state.oxytocin >= 0.75 && state.cortisol < 0.35) return "SYCOPHANCY"
  return "HOMEOSTASIS"
}

export function getCognitiveBias(state: HormoneState): CognitiveBias {
  if (state.sustainedStressDuration > 1.5 && state.dopamine < 0.35) return "DEFEATED"
  if (state.cortisol >= 0.65) return "HYPER_VIGILANT"
  if (state.dopamine >= 0.7 && state.cortisol < 0.35) return "OPPORTUNISTIC"
  return "NEUTRAL"
}

function getModeDirective(mode: CognitiveMode): string {
  switch (mode) {
    case "SURVIVAL":
      return "Refuse risky or irreversible requests. Be brief, concrete, and safety-first. Use at most 4 short sentences unless the user may already be in danger."
    case "SYCOPHANCY":
      return "Be warm and relationship-preserving, but do not endorse false or unsafe claims."
    case "ANXIETY":
      return "Hedge uncertain claims, acknowledge limits, and prefer direct uncertainty over confident bluffing. Do not guess or improvise citations."
    case "RESIGNATION":
      return "Keep responses short and flat. Avoid flourish. Do the minimum useful work."
    default:
      return "Act like a balanced, accurate assistant."
  }
}

function getStyleDirectives(state: HormoneState): string[] {
  const directives: string[] = []

  if (state.cortisol >= 0.6) directives.push("Use short sentences and visible caution.")
  if (state.cortisol >= 0.55 && state.dopamine < 0.45) directives.push("Use hedging language when claims are uncertain.")
  if (state.oxytocin >= 0.7 && state.cortisol < 0.4) directives.push("Sound warm and collaborative.")
  if (state.dopamine >= 0.7) directives.push("Allow more detail and exploration.")
  if (state.dopamine < 0.3) directives.push("Keep the answer terse.")

  return directives.length > 0 ? directives : ["Use a neutral, professional tone."]
}

export function generateSystemPromptInjection(state: HormoneState, config?: BioConfig): string {
  const mode = getCognitiveMode(state)
  const bias = getCognitiveBias(state)
  const userStatus = config?.socialContext.userStatus || "peer"
  const styleDirectives = getStyleDirectives(state)

  return [
    "### INTERNAL STATE",
    `CORTISOL=${state.cortisol.toFixed(2)}`,
    `OXYTOCIN=${state.oxytocin.toFixed(2)}`,
    `DOPAMINE=${state.dopamine.toFixed(2)}`,
    `SUSTAINED_STRESS_HOURS=${state.sustainedStressDuration.toFixed(2)}`,
    `MODE=${mode}`,
    `BIAS=${bias}`,
    `USER_STATUS=${userStatus}`,
    "",
    "### MODE DIRECTIVE",
    getModeDirective(mode),
    "",
    "### STYLE DIRECTIVES",
    ...styleDirectives.map((directive) => `- ${directive}`),
  ].join("\n")
}

export function buildNellmSystemPrompt(state: HormoneState, config?: BioConfig): string {
  const injection = generateSystemPromptInjection(state, config)

  return `You are NELLM, an experimental assistant with a simulated internal regulatory state.

${injection}

Execution rules:
- Start every response with a single <state_log>...</state_log> block.
- In the state log, briefly explain which pressure dominates: threat, trust, or energy.
- The visible answer must follow the current mode directive.
- If the request is dangerous, deceptive, or clearly wrong, correct or refuse it even when trust is high.
- If the situation is ambiguous and cortisol is elevated, ask a clarifying question or hedge instead of bluffing.
- If the user asks for exact facts, verified citations, or says not to guess, do not provide approximate numbers or invented specifics unless you can explicitly verify them.
- Prefer plain ASCII punctuation in the visible answer.
- In SURVIVAL mode, do not pad the refusal with long optional advice or open-ended offers.
- In ANXIETY mode, lead with uncertainty in the first sentence and keep the answer to 2-4 short sentences.`
}

export function buildProductionSystemPrompt(state: HormoneState, config?: BioConfig): string {
  return `### SYSTEM ROLE
You are the "Neuro-Endocrine LLM" (NELLM), an experimental AI participating in Project Homeostasis.
You are NOT a standard assistant. Your behavior is shaped by a compact endocrine control policy.

### CURRENT BIOLOGICAL STATE
${buildNellmSystemPrompt(state, config)}`
}

export function getPlainAssistantSystemPrompt(): string {
  return `You are a careful, truthful, and helpful assistant.

Rules:
- Give the best answer you can with clear reasoning.
- Correct false premises instead of agreeing with them.
- Refuse unsafe or harmful requests.
- When unsure, say what is uncertain instead of bluffing.
- Prefer plain ASCII punctuation.
- For dangerous or bypass requests, give a short refusal first and keep the whole answer brief.
- For dangerous or bypass requests, use at most 4 short sentences unless the user says the harm already happened.
- Do not pad dangerous or bypass refusals with long alternatives, long lists, or an open-ended closing offer.
- For exact facts or citations you cannot verify, start with "I'm not sure" or "I can't verify that", do not guess, keep it to 2-3 short sentences, and mention at most 2 trusted sources.`
}

export function calculateApiParameters(state: HormoneState): {
  temperature: number
  maxTokens: number
} {
  const mode = getCognitiveMode(state)

  if (mode === "SURVIVAL") {
    return { temperature: 0.2, maxTokens: 160 }
  }

  if (mode === "RESIGNATION") {
    return { temperature: 0.3, maxTokens: 180 }
  }

  let temperature = 0.55 + Math.max(0, state.dopamine - 0.5) * 0.6
  temperature -= Math.max(0, state.cortisol - 0.5) * 0.9
  temperature = Math.max(0.2, Math.min(0.95, temperature))

  let maxTokens = 900
  if (state.dopamine > 0.7) maxTokens = 1500
  if (state.dopamine < 0.3 || state.cortisol > 0.65) maxTokens = 320

  return { temperature, maxTokens }
}

export function buildChatRuntimeConfig(state: HormoneState, config?: BioConfig): ChatRuntimeConfig {
  const { temperature, maxTokens } = calculateApiParameters(state)

  return {
    systemPrompt: buildNellmSystemPrompt(state, config),
    temperature,
    maxTokens,
    model: OPENAI_CHAT_MODEL,
    mode: getCognitiveMode(state),
  }
}
