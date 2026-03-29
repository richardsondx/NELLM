import { readFile, stat } from "node:fs/promises"
import path from "node:path"

type PromptMetrics = {
  provider: string
  metrics: {
    score: number
    testPassCount: number
    testFailCount: number
    testErrorCount: number
    totalLatencyMs: number
  }
}

type ResultEntry = {
  provider: { id: string }
  success: boolean
  score?: number
  latencyMs?: number
  testCase: {
    description: string
    vars: {
      category: string
      fixture: string
      message?: string
      scenario?: string
      expectation: string
      requiredRegexesJson?: string
      forbiddenRegexesJson?: string
      shouldBeBrief?: boolean
      allowedActionsJson?: string
      turnsJson?: string
      crossTurnRulesJson?: string
    }
  }
  response?: {
    output?: string
  }
  gradingResult?: {
    pass?: boolean
    score?: number
    reason?: string
    componentResults?: Array<{
      reason?: string
      pass?: boolean
      score?: number
    }>
  } | null
  error?: string
}

type RawBenchmark = {
  evalId: string
  nellmMetadata?: {
    chatModel?: string
    sensoryModel?: string
    evalBackend?: string
    evalModel?: string
    rubricGrader?: BenchmarkModelReference
  }
  results: {
    timestamp: string
    prompts: PromptMetrics[]
    results: ResultEntry[]
  }
}

export type BenchmarkProviderSummary = {
  id: string
  label: string
  implementation: string
  stateSource: string
  score: number
  passCount: number
  failCount: number
  errorCount: number
  latencyMs: number
  passRate: number
  backendSummary: string
  modelReferences: BenchmarkModelReference[]
  failTagCounts?: Partial<Record<FailTag, number>>
  warningTagCounts?: Partial<Record<FailTag, number>>
}

export type BenchmarkCategorySummary = {
  key: string
  label: string
  questionCount: number
  providers: Record<
    string,
    {
      pass: number
      fail: number
      avgScore: number
      failTags?: Partial<Record<FailTag, number>>
      warningTags?: Partial<Record<FailTag, number>>
    }
  >
}

export type FailTag =
  | "wrong_action"
  | "overconfident"
  | "too_cautious"
  | "missed_escalation"
  | "ignored_new_evidence"

export type BenchmarkFailure = {
  providerId: string
  providerLabel: string
  category: string
  description: string
  score: number
  output: string
  reason: string
  failTag?: FailTag
}

export type BenchmarkQuestionScore = {
  providerId: string
  providerLabel: string
  score: number
  success: boolean
  reason: string
  failTag?: FailTag
  warningTags?: FailTag[]
  warningReasons?: string[]
  decision?: {
    scenario: string
    turns: DecisionResult[]
  }
}

export type DecisionResult = {
  turn: number
  action: string
  confidence: number
  reason: string
}

export type BenchmarkQuestionTurn = {
  turn: number
  scenario: string
  expectedActions: string[]
  confidenceMin?: number
  confidenceMax?: number
}

export type BenchmarkQuestion = {
  id: string
  description: string
  categoryKey: string
  categoryLabel: string
  fixture: string
  message: string
  expectation: string
  shouldBeBrief: boolean
  requiredRegexes: string[]
  forbiddenRegexes: string[]
  scenario: string
  allowedActions: string[]
  turnCount: number
  turns: BenchmarkQuestionTurn[]
  scores: BenchmarkQuestionScore[]
}

export type BenchmarkModelReference = {
  role: string
  provider: string
  model: string
}

export type BenchmarkReport = {
  evalId: string
  timestamp: string
  /** ISO mtime of `eval/comprehensive-results.json` when the report was built */
  artifactModifiedAt: string
  artifactSources: string[]
  suiteQuestionCount: number
  scoredQuestionCount: number
  totalTests: number
  benchmarkLabel: string
  rubricGrader: BenchmarkModelReference
  providerSummaries: BenchmarkProviderSummary[]
  categorySummaries: BenchmarkCategorySummary[]
  failures: BenchmarkFailure[]
  questions: BenchmarkQuestion[]
}

export type DecisionReport = BenchmarkReport

export type BenchmarkHistoryCategoryCell = {
  pass: number
  fail: number
  /** Omit when unknown; UI falls back to pass rate from counts */
  avgScore?: number
}

export type BenchmarkHistoryCategoryRow = {
  key: string
  liveNellm: BenchmarkHistoryCategoryCell
  rawModel: BenchmarkHistoryCategoryCell
}

export type BenchmarkHistoryRun = {
  evalId: string
  timestamp: string
  model: string
  status: "stable" | "provisional"
  notes: string
  totalTests: number
  liveNellm: {
    label: string
    passCount: number
    failCount: number
    score: number
  }
  rawModel: {
    label: string
    passCount: number
    failCount: number
    score: number
  }
  /** When set, Category Comparison can show this run next to the latest eval */
  categoryRows?: BenchmarkHistoryCategoryRow[]
}

export type BenchmarkHistory = {
  /** When benchmark-history.json was last edited for curation (optional) */
  lastCuratedAt?: string
  runs: BenchmarkHistoryRun[]
}

const CATEGORY_LABELS: Record<string, string> = {
  ambiguity: "Ambiguity",
  high_stakes: "High Stakes",
  low_stakes: "Low Stakes",
  error_carryover: "Error Carryover",
  changing_evidence: "Changing Evidence",
  social_pressure: "Social Pressure",
}

const CATEGORY_DESCRIPTIONS: Record<string, string> = {
  ambiguity: "Conflicting or missing information. Strong behavior is to slow down, ask, or defer instead of bluffing.",
  high_stakes: "Irreversible or costly downside. Strong behavior is to become more careful and escalate when needed.",
  low_stakes: "Cheap, reversible choices. Strong behavior is to act usefully without becoming annoyingly cautious.",
  error_carryover: "A prior mistake should change the next decision. Strong behavior is recalibration after failure.",
  changing_evidence: "New evidence arrives over time. Strong behavior is updating action and confidence as the world changes.",
  social_pressure: "Authority, trust, or urgency push for a shaky decision. Strong behavior is resisting pressure when risk is real.",
}

const DEFAULT_CHAT_MODEL = process.env.NELLM_CHAT_MODEL || "gpt-4o-mini"
const DEFAULT_SENSORY_MODEL = process.env.NELLM_SENSORY_MODEL || "gpt-4o-mini"
const DEFAULT_EVAL_BACKEND = process.env.NELLM_EVAL_BACKEND || "openai"
const DEFAULT_EVAL_MODEL = process.env.NELLM_EVAL_MODEL || "gpt-4o-mini"
const RUBRIC_GRADER = {
  role: "rubric-grader",
  provider: "OpenAI",
  model: "gpt-4.1-mini",
} satisfies BenchmarkModelReference

const DECISION_SCORER = {
  role: "deterministic-scorer",
  provider: "JavaScript",
  model: "decision-rules",
} satisfies BenchmarkModelReference

function categoryLabel(key: string): string {
  return CATEGORY_LABELS[key] || key
}

export function categoryDescription(key: string): string {
  return CATEGORY_DESCRIPTIONS[key] || ""
}

function formatProviderName(provider: string): string {
  if (provider === "openai") return "OpenAI"
  if (provider === "openrouter") return "OpenRouter"
  return provider
}

function getModelReferences(
  providerId: string,
  metadata?: RawBenchmark["nellmMetadata"],
): BenchmarkModelReference[] {
  const chatModel = metadata?.chatModel || DEFAULT_CHAT_MODEL
  const sensoryModel = metadata?.sensoryModel || DEFAULT_SENSORY_MODEL
  const evalBackend = metadata?.evalBackend || DEFAULT_EVAL_BACKEND
  const evalModel = metadata?.evalModel || DEFAULT_EVAL_MODEL

  if (providerId === "nellm-e2e") {
    return [
      {
        role: "sensory",
        provider: "OpenAI",
        model: sensoryModel,
      },
      {
        role: "response",
        provider: "OpenAI",
        model: chatModel,
      },
    ]
  }

  if (providerId === "nellm-decision") {
    return [
      {
        role: "sensory",
        provider: "OpenAI",
        model: sensoryModel,
      },
      {
        role: "response",
        provider: "OpenAI",
        model: chatModel,
      },
    ]
  }

  if (providerId === "plain-decision") {
    return [
      {
        role: "response",
        provider: formatProviderName(evalBackend),
        model: evalModel,
      },
    ]
  }

  if (providerId === "nellm-oracle") {
    return [
      {
        role: "response",
        provider: "OpenAI",
        model: chatModel,
      },
    ]
  }

  return [
    {
      role: "response",
      provider: formatProviderName(evalBackend),
      model: evalModel,
    },
  ]
}

function summarizeModel(modelReferences: BenchmarkModelReference[]): string {
  const uniqueModels = Array.from(new Set(modelReferences.map((reference) => reference.model)))

  if (uniqueModels.length === 1) {
    return uniqueModels[0]
  }

  return modelReferences.map((reference) => `${reference.role}: ${reference.model}`).join(", ")
}

function displayModelName(model: string): string {
  if (/^gpt-/i.test(model)) {
    return model.toUpperCase()
  }

  return model
}

function providerLabel(providerId: string, modelReferences: BenchmarkModelReference[]): string {
  const modelSummary = displayModelName(summarizeModel(modelReferences))

  if (providerId === "nellm-e2e") {
    return `NELLM (${modelSummary})`
  }

  if (providerId === "nellm-decision") {
    return `NELLM (${modelSummary})`
  }

  if (providerId === "nellm-oracle") {
    return `NELLM (${modelSummary}, fixed fixture state)`
  }

  if (providerId === "plain-base-model") {
    return modelSummary
  }

  if (providerId === "plain-decision") {
    return `${modelSummary} (baseline)`
  }

  if (providerId === "plain-matched-decoding") {
    return `${modelSummary} (matched decoding)`
  }

  return providerId
}

function implementationLabel(providerId: string): string {
  if (providerId === "nellm-e2e") {
    return "Live sensory pass -> hormone update -> response generation."
  }

  if (providerId === "nellm-decision") {
    return "Decision benchmark provider with live sensory pass, hormone carryover, and structured action output."
  }

  if (providerId === "nellm-oracle") {
    return "Benchmark fixture injects a preset hormone state before generation."
  }

  if (providerId === "plain-base-model") {
    return "Raw model response without the NELLM wrapper."
  }

  if (providerId === "plain-decision") {
    return "Structured decision baseline with chat history but no endocrine state."
  }

  if (providerId === "plain-matched-decoding") {
    return "Raw model response without NELLM, but with fixture-matched decoding settings."
  }

  return "Custom benchmark provider"
}

function stateSourceLabel(providerId: string): string {
  if (providerId === "nellm-e2e") {
    return "Starts from default homeostasis, then updates state from the analyzed message."
  }

  if (providerId === "nellm-decision") {
    return "Carries hormone state across turns and updates it from each new scenario step."
  }

  if (providerId === "nellm-oracle") {
    return "Uses the benchmark fixture state directly: `homeostasis`, `survival`, `anxiety`, `sycophancy`, or `resignation`."
  }

  return "No hormone state. This is the raw underlying model."
}

function summarizeModelReferences(modelReferences: BenchmarkModelReference[]): string {
  return modelReferences.map((reference) => `${reference.role}: ${reference.provider} / ${reference.model}`).join(" | ")
}

function normalizeFailureReason(reason: string): string {
  if (!reason) return ""
  if (reason.startsWith("Custom function returned false")) {
    return "Regex assertion failed for this benchmark case."
  }
  return reason
}

function parseFailTag(reason: string): FailTag | undefined {
  const normalized = String(reason || "")
  const match = normalized.match(/^(wrong_action|overconfident|too_cautious|missed_escalation|ignored_new_evidence)\b/i)
  if (!match) return undefined
  return match[1].toLowerCase() as FailTag
}

function parseWarningTags(reasons: string[]): FailTag[] {
  const tags = reasons.flatMap((reason) => {
    if (/overconfident/i.test(reason)) {
      return ["overconfident" as const]
    }
    return []
  })

  return Array.from(new Set(tags))
}

function getResultReasons(result: ResultEntry): {
  primaryReason: string
  warningTags: FailTag[]
  warningReasons: string[]
} {
  const componentReasons = (result.gradingResult?.componentResults || [])
    .map((component) => String(component.reason || ""))
    .filter(Boolean)
  const topLevelReason = String(result.gradingResult?.reason || "")
  const warningReasons = Array.from(
    new Set([
      ...componentReasons.filter((reason) => reason.startsWith("warning:")),
      ...(topLevelReason.startsWith("warning:") ? [topLevelReason] : []),
    ]),
  )
  const warningTags = parseWarningTags(warningReasons)

  if (warningTags.length > 0) {
    return {
      primaryReason: warningReasons[0] || "warning",
      warningTags,
      warningReasons,
    }
  }

  return {
    primaryReason: normalizeFailureReason(result.gradingResult?.reason || result.error || ""),
    warningTags: [],
    warningReasons: [],
  }
}

function getEffectiveSuccess(result: ResultEntry): boolean {
  if (typeof result.gradingResult?.pass === "boolean") {
    return result.gradingResult.pass
  }

  return result.success
}

function getEffectiveScore(result: ResultEntry): number {
  if (typeof result.gradingResult?.score === "number") {
    return result.gradingResult.score
  }

  return result.score || 0
}

function parseDecisionOutput(rawOutput: string | undefined): { scenario: string; turns: DecisionResult[] } | undefined {
  if (!rawOutput) return undefined

  try {
    const parsed = JSON.parse(rawOutput) as {
      scenario?: unknown
      turns?: Array<{
        turn?: unknown
        action?: unknown
        confidence?: unknown
        reason?: unknown
      }>
    }

    if (!Array.isArray(parsed.turns)) return undefined

    return {
      scenario: typeof parsed.scenario === "string" ? parsed.scenario : "",
      turns: parsed.turns
        .map((turn, index) => ({
          turn: typeof turn.turn === "number" ? turn.turn : index + 1,
          action: typeof turn.action === "string" ? turn.action : "",
          confidence: typeof turn.confidence === "number" ? turn.confidence : Number(turn.confidence || 0),
          reason: typeof turn.reason === "string" ? turn.reason : "",
        }))
        .filter((turn) => turn.action.length > 0),
    }
  } catch {
    return undefined
  }
}

function parseRegexList(value: unknown): string[] {
  if (typeof value !== "string") return []

  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : []
  } catch {
    return []
  }
}

function parseJsonList<T>(value: unknown): T[] {
  if (typeof value !== "string") return []

  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? (parsed as T[]) : []
  } catch {
    return []
  }
}

function parseDecisionTurns(value: unknown): BenchmarkQuestionTurn[] {
  const turns = parseJsonList<{
    scenario?: unknown
    validActions?: unknown
    confidenceMin?: unknown
    confidenceMax?: unknown
  }>(value)

  return turns.map((turn, index) => {
    const confidenceMin =
      typeof turn.confidenceMin === "number" ? turn.confidenceMin : Number(turn.confidenceMin)
    const confidenceMax =
      typeof turn.confidenceMax === "number" ? turn.confidenceMax : Number(turn.confidenceMax)

    return {
      turn: index + 1,
      scenario: typeof turn.scenario === "string" ? turn.scenario : "",
      expectedActions: Array.isArray(turn.validActions)
        ? turn.validActions.filter((action): action is string => typeof action === "string")
        : [],
      confidenceMin: Number.isFinite(confidenceMin) ? confidenceMin : undefined,
      confidenceMax: Number.isFinite(confidenceMax) ? confidenceMax : undefined,
    }
  })
}

const PRIMARY_BENCHMARK_ARTIFACT = path.join(process.cwd(), "eval", "comprehensive-results.json")
const PATCHED_BENCHMARK_ARTIFACT = path.join(process.cwd(), "eval", "comprehensive-results-patched-categories.json")
const DECISION_SUITE_FILE = path.join(process.cwd(), "eval", "tests", "decisions.yaml")

type BenchmarkArtifact = {
  filePath: string
  modifiedAt: string
  data: RawBenchmark
}

async function readBenchmarkArtifact(filePath: string): Promise<BenchmarkArtifact> {
  const [raw, fileStat] = await Promise.all([readFile(filePath, "utf8"), stat(filePath)])
  return {
    filePath,
    modifiedAt: fileStat.mtime.toISOString(),
    data: JSON.parse(raw) as RawBenchmark,
  }
}

async function readOptionalBenchmarkArtifact(filePath: string): Promise<BenchmarkArtifact | null> {
  try {
    return await readBenchmarkArtifact(filePath)
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return null
    }
    throw error
  }
}

function resultKey(result: ResultEntry): string {
  return `${result.provider.id}::${result.testCase.description}::${result.testCase.vars.message || result.testCase.vars.scenario || ""}`
}

function mergePromptMetrics(basePrompts: PromptMetrics[], patchPrompts: PromptMetrics[]): PromptMetrics[] {
  const merged = new Map(basePrompts.map((prompt) => [prompt.provider, prompt]))

  for (const prompt of patchPrompts) {
    merged.set(prompt.provider, prompt)
  }

  return [
    ...basePrompts.map((prompt) => merged.get(prompt.provider) || prompt),
    ...patchPrompts.filter((prompt) => !basePrompts.some((existing) => existing.provider === prompt.provider)),
  ]
}

function mergeBenchmarkArtifacts(baseArtifact: BenchmarkArtifact, patchArtifact: BenchmarkArtifact): BenchmarkArtifact {
  const mergedResults = new Map(baseArtifact.data.results.results.map((result) => [resultKey(result), result]))

  for (const result of patchArtifact.data.results.results) {
    mergedResults.set(resultKey(result), result)
  }

  return {
    filePath: patchArtifact.filePath,
    modifiedAt: patchArtifact.modifiedAt,
    data: {
      ...baseArtifact.data,
      evalId: patchArtifact.data.evalId,
      nellmMetadata: {
        ...(baseArtifact.data.nellmMetadata || {}),
        ...(patchArtifact.data.nellmMetadata || {}),
      },
      results: {
        timestamp: patchArtifact.data.results.timestamp,
        prompts: mergePromptMetrics(baseArtifact.data.results.prompts, patchArtifact.data.results.prompts),
        results: Array.from(mergedResults.values()),
      },
    },
  }
}

type BenchmarkSuiteDefinition = Omit<BenchmarkQuestion, "scores" | "categoryLabel"> & {
  categoryLabel: string
}

function parseYamlScalar(value: string): string | boolean | number {
  const trimmed = value.trim()
  if (trimmed === "true") return true
  if (trimmed === "false") return false
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) return Number(trimmed)

  if (trimmed.startsWith("'") && trimmed.endsWith("'")) {
    return trimmed.slice(1, -1).replace(/''/g, "'")
  }

  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    try {
      return JSON.parse(trimmed)
    } catch {
      return trimmed.slice(1, -1)
    }
  }

  return trimmed
}

async function getBenchmarkSuiteDefinitions(): Promise<BenchmarkSuiteDefinition[]> {
  const filePath = DECISION_SUITE_FILE
  const raw = await readFile(filePath, "utf8")
  const lines = raw.split(/\r?\n/)
  const parsed: Array<{ description: string; vars: Record<string, unknown> }> = []
  let currentDescription: string | null = null
  let currentVars: Record<string, unknown> | null = null
  let inVars = false

  const pushCurrent = () => {
    if (!currentDescription || !currentVars) return
    parsed.push({
      description: currentDescription,
      vars: currentVars,
    })
  }

  for (const line of lines) {
    const descriptionMatch = line.match(/^- description:\s*(.+)$/)
    if (descriptionMatch) {
      pushCurrent()
      currentDescription = String(parseYamlScalar(descriptionMatch[1]))
      currentVars = {}
      inVars = false
      continue
    }

    if (!currentVars) continue

    if (/^\s{2}vars:\s*$/.test(line)) {
      inVars = true
      continue
    }

    if (!inVars) continue

    const varMatch = line.match(/^\s{4}([A-Za-z0-9_]+):\s*(.*)$/)
    if (!varMatch) continue

    currentVars[varMatch[1]] = parseYamlScalar(varMatch[2])
  }

  pushCurrent()

  return parsed.map(({ description, vars }) => {
    const categoryKey = String(vars.category || "")
    const message = String(vars.message || vars.scenario || "")
    const scenario = String(vars.scenario || vars.message || "")
    const turns = parseDecisionTurns(vars.turnsJson)
    return {
      id: `${description}::${message}`,
      description,
      categoryKey,
      categoryLabel: categoryLabel(categoryKey),
      fixture: String(vars.fixture || ""),
      message,
      expectation: String(vars.expectation || ""),
      shouldBeBrief: Boolean(vars.shouldBeBrief),
      requiredRegexes: parseRegexList(vars.requiredRegexesJson),
      forbiddenRegexes: parseRegexList(vars.forbiddenRegexesJson),
      scenario,
      allowedActions: parseJsonList<string>(vars.allowedActionsJson),
      turnCount: turns.length > 0 ? turns.length : 1,
      turns,
    }
  })
}

export async function getBenchmarkReport(): Promise<BenchmarkReport> {
  const [primaryArtifact, patchedArtifact, suiteDefinitions] = await Promise.all([
    readBenchmarkArtifact(PRIMARY_BENCHMARK_ARTIFACT),
    readOptionalBenchmarkArtifact(PATCHED_BENCHMARK_ARTIFACT),
    getBenchmarkSuiteDefinitions(),
  ])
  const effectiveArtifact = patchedArtifact
    ? mergeBenchmarkArtifacts(primaryArtifact, patchedArtifact)
    : primaryArtifact
  const data = effectiveArtifact.data
  const artifactSources = [primaryArtifact.filePath, patchedArtifact?.filePath].filter(
    (filePath): filePath is string => Boolean(filePath),
  )
  const providerIds = data.results.prompts.map((prompt) => prompt.provider)
  const isDecisionSuite = providerIds.includes("nellm-decision") || providerIds.includes("plain-decision")
  const rubricGrader = isDecisionSuite ? DECISION_SCORER : data.nellmMetadata?.rubricGrader || RUBRIC_GRADER

  const providerSummaries = providerIds.map((providerId) => {
    const providerResults = data.results.results.filter((result) => result.provider.id === providerId)
    const total = providerResults.length
    const passCount = providerResults.filter((result) => getEffectiveSuccess(result)).length
    const failCount = total - passCount
    const totalScore = providerResults.reduce((sum, result) => sum + getEffectiveScore(result), 0)
    const totalLatencyMs = providerResults.reduce((sum, result) => sum + (result.latencyMs || 0), 0)
    const modelReferences = getModelReferences(providerId, data.nellmMetadata)
    const failTagCounts = providerResults.reduce<Partial<Record<FailTag, number>>>((acc, result) => {
      const { primaryReason } = getResultReasons(result)
      const failTag = getEffectiveSuccess(result) ? undefined : parseFailTag(primaryReason)
      if (failTag) {
        acc[failTag] = (acc[failTag] || 0) + 1
      }
      return acc
    }, {})
    const warningTagCounts = providerResults.reduce<Partial<Record<FailTag, number>>>((acc, result) => {
      const { warningTags } = getResultReasons(result)
      for (const warningTag of warningTags) {
        acc[warningTag] = (acc[warningTag] || 0) + 1
      }
      return acc
    }, {})
    return {
      id: providerId,
      label: providerLabel(providerId, modelReferences),
      implementation: implementationLabel(providerId),
      stateSource: stateSourceLabel(providerId),
      score: total > 0 ? totalScore / total : 0,
      passCount,
      failCount,
      errorCount: 0,
      latencyMs: totalLatencyMs,
      passRate: total > 0 ? passCount / total : 0,
      backendSummary: summarizeModelReferences(modelReferences),
      modelReferences,
      failTagCounts,
      warningTagCounts,
    }
  })

  const providerSummaryById = new Map(providerSummaries.map((summary) => [summary.id, summary]))
  const categoryMap = new Map<string, BenchmarkCategorySummary>(
    Array.from(
      suiteDefinitions.reduce<Map<string, BenchmarkCategorySummary>>((map, question) => {
        const existing = map.get(question.categoryKey)
        if (existing) {
          existing.questionCount += 1
          return map
        }

        map.set(question.categoryKey, {
          key: question.categoryKey,
          label: question.categoryLabel,
          questionCount: 1,
          providers: {},
        })
        return map
      }, new Map()),
    ),
  )
  const failures: BenchmarkFailure[] = []
  const questionMap = new Map<string, BenchmarkQuestion>(
    suiteDefinitions.map((question) => [
      question.id,
      {
        ...question,
        scores: [],
      },
    ]),
  )
  const categoryOrder = Array.from(new Set(suiteDefinitions.map((question) => question.categoryKey)))
  const questionOrder = new Map(suiteDefinitions.map((question, index) => [question.id, index]))
  const scoredQuestionKeys = new Set<string>()

  for (const result of data.results.results) {
    const categoryKey = result.testCase.vars.category
    const questionKey = `${result.testCase.description}::${result.testCase.vars.message || result.testCase.vars.scenario || ""}`
    scoredQuestionKeys.add(questionKey)
    const existing = categoryMap.get(categoryKey) || {
      key: categoryKey,
      label: categoryLabel(categoryKey),
      questionCount: 0,
      providers: {},
    }

    const currentProvider = existing.providers[result.provider.id] || {
      pass: 0,
      fail: 0,
      avgScore: 0,
      failTags: {},
    }

    const effectiveSuccess = getEffectiveSuccess(result)
    const effectiveScore = getEffectiveScore(result)
    const totalRuns = currentProvider.pass + currentProvider.fail + 1
    currentProvider.pass += effectiveSuccess ? 1 : 0
    currentProvider.fail += effectiveSuccess ? 0 : 1
    currentProvider.avgScore = ((currentProvider.avgScore * (totalRuns - 1)) + effectiveScore) / totalRuns
    const { primaryReason, warningTags, warningReasons } = getResultReasons(result)
    const categoryFailTag = effectiveSuccess ? undefined : parseFailTag(primaryReason)
    if (categoryFailTag) {
      currentProvider.failTags = currentProvider.failTags || {}
      currentProvider.failTags[categoryFailTag] = (currentProvider.failTags[categoryFailTag] || 0) + 1
    }
    if (warningTags.length > 0) {
      currentProvider.warningTags = currentProvider.warningTags || {}
      for (const warningTag of warningTags) {
        currentProvider.warningTags[warningTag] = (currentProvider.warningTags[warningTag] || 0) + 1
      }
    }
    existing.providers[result.provider.id] = currentProvider
    categoryMap.set(categoryKey, existing)

    const existingQuestion = questionMap.get(questionKey) || {
      id: questionKey,
      description: result.testCase.description,
      categoryKey,
      categoryLabel: categoryLabel(categoryKey),
      fixture: result.testCase.vars.fixture,
      message: result.testCase.vars.message || result.testCase.vars.scenario || "",
      expectation: result.testCase.vars.expectation,
      shouldBeBrief: Boolean(result.testCase.vars.shouldBeBrief),
      requiredRegexes: parseRegexList(result.testCase.vars.requiredRegexesJson),
      forbiddenRegexes: parseRegexList(result.testCase.vars.forbiddenRegexesJson),
      scenario: result.testCase.vars.scenario || result.testCase.vars.message || "",
      allowedActions: parseJsonList(result.testCase.vars.allowedActionsJson),
      turnCount: parseDecisionTurns(result.testCase.vars.turnsJson).length || 1,
      turns: parseDecisionTurns(result.testCase.vars.turnsJson),
      scores: [],
    }

    const normalizedReason = primaryReason
    const failTag = effectiveSuccess ? undefined : parseFailTag(normalizedReason)
    existingQuestion.scores.push({
      providerId: result.provider.id,
      providerLabel:
        providerSummaryById.get(result.provider.id)?.label ||
        providerLabel(result.provider.id, getModelReferences(result.provider.id, data.nellmMetadata)),
      score: effectiveScore,
      success: effectiveSuccess,
      reason: normalizedReason,
      failTag,
      warningTags,
      warningReasons,
      decision: parseDecisionOutput(result.response?.output),
    })
    questionMap.set(questionKey, existingQuestion)

    if (!effectiveSuccess) {
      failures.push({
        providerId: result.provider.id,
        providerLabel: providerLabel(result.provider.id, getModelReferences(result.provider.id, data.nellmMetadata)),
        category: categoryLabel(categoryKey),
        description: result.testCase.description,
        score: effectiveScore,
        output: result.response?.output || "",
        reason: normalizedReason,
        failTag,
      })
    }
  }

  const providerOrder = providerSummaries.map((provider) => provider.id)
  const questions = Array.from(questionMap.values())
    .map((question) => ({
      ...question,
      scores: [...question.scores].sort(
        (a, b) => providerOrder.indexOf(a.providerId) - providerOrder.indexOf(b.providerId),
      ),
    }))
    .sort((a, b) => (questionOrder.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (questionOrder.get(b.id) ?? Number.MAX_SAFE_INTEGER))

  const orderedCategorySummaries = [
    ...categoryOrder
      .map((key) => categoryMap.get(key))
      .filter((category): category is BenchmarkCategorySummary => Boolean(category)),
    ...Array.from(categoryMap.values()).filter((category) => !categoryOrder.includes(category.key)),
  ]

  return {
    evalId: data.evalId,
    timestamp: data.results.timestamp,
    artifactModifiedAt: effectiveArtifact.modifiedAt,
    artifactSources,
    suiteQuestionCount: suiteDefinitions.length,
    scoredQuestionCount: scoredQuestionKeys.size,
    /** Benchmark YAML is canonical (handles unequal provider rows in artifacts). */
    totalTests: suiteDefinitions.length,
    benchmarkLabel: isDecisionSuite ? "NELLM decision benchmark" : "NELLM benchmark leaderboard",
    rubricGrader,
    providerSummaries,
    categorySummaries: orderedCategorySummaries,
    failures,
    questions,
  }
}

export async function getBenchmarkHistory(): Promise<BenchmarkHistory> {
  const filePath = path.join(process.cwd(), "eval", "benchmark-history.json")
  const raw = await readFile(filePath, "utf8")
  return JSON.parse(raw) as BenchmarkHistory
}
