#!/usr/bin/env node
/**
 * Patch nellmMetadata on a Promptfoo comprehensive-results.json and merge a history row
 * into benchmark-history.json (by model id: replaces existing run with same --model).
 */
import { readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))

function displayModel(model) {
  if (/^gpt-/i.test(model)) return model.toUpperCase()
  return model
}

function parseArgs() {
  const args = process.argv.slice(2)
  const out = { resultsPath: "", model: "", status: "stable", sensory: "", evalModel: "", skipHistory: false }
  for (let i = 0; i < args.length; i++) {
    const a = args[i]
    if (a === "--skip-history") out.skipHistory = true
    else if (a === "--model") out.model = args[++i]
    else if (a === "--status") out.status = args[++i]
    else if (a === "--sensory") out.sensory = args[++i]
    else if (a === "--eval-model") out.evalModel = args[++i]
    else if (!out.resultsPath) out.resultsPath = path.resolve(a)
  }
  if (!out.resultsPath || !out.model) {
    console.error(
      "Usage: node eval/ingest-eval-run.mjs <comprehensive-results.json> --model gpt-5.4 [--sensory gpt-5.4] [--eval-model gpt-5.4] [--status stable|provisional] [--skip-history]",
    )
    process.exit(1)
  }
  out.sensory = out.sensory || out.model
  out.evalModel = out.evalModel || out.model
  return out
}

function buildCategoryRows(data) {
  const map = new Map()
  for (const r of data.results.results || []) {
    const pid = r.provider?.id
    if (pid !== "nellm-e2e" && pid !== "plain-base-model") continue
    const cat = r.testCase?.vars?.category
    if (!cat) continue
    if (!map.has(cat)) map.set(cat, { nellm: { pass: 0, fail: 0, sum: 0, n: 0 }, raw: { pass: 0, fail: 0, sum: 0, n: 0 } })
    const row = map.get(cat)
    const bucket = pid === "nellm-e2e" ? row.nellm : row.raw
    bucket.pass += r.success ? 1 : 0
    bucket.fail += r.success ? 0 : 1
    bucket.sum += typeof r.score === "number" ? r.score : 0
    bucket.n += 1
  }
  return [...map.entries()].map(([key, { nellm: e, raw: b }]) => ({
    key,
    liveNellm: {
      pass: e.pass,
      fail: e.fail,
      avgScore: e.n ? Math.round((e.sum / e.n) * 1000) / 1000 : 0,
    },
    rawModel: {
      pass: b.pass,
      fail: b.fail,
      avgScore: b.n ? Math.round((b.sum / b.n) * 1000) / 1000 : 0,
    },
  }))
}

function promptMetrics(data, providerId) {
  const p = data.results.prompts.find((x) => x.provider === providerId)
  if (!p) throw new Error(`No prompts entry for ${providerId}`)
  const m = p.metrics
  return { passCount: m.testPassCount, failCount: m.testFailCount, scoreSum: m.score }
}

function avgScoreFromResults(data, providerId) {
  let sum = 0
  let n = 0
  for (const r of data.results.results || []) {
    if (r.provider?.id !== providerId) continue
    sum += typeof r.score === "number" ? r.score : 0
    n += 1
  }
  return n ? Math.round((sum / n) * 1000) / 1000 : 0
}

async function main() {
  const opts = parseArgs()
  const raw = await readFile(opts.resultsPath, "utf8")
  const data = JSON.parse(raw)

  data.nellmMetadata = {
    ...(data.nellmMetadata || {}),
    chatModel: opts.model,
    sensoryModel: opts.sensory,
    evalBackend: "openai",
    evalModel: opts.evalModel,
    rubricGrader: data.nellmMetadata?.rubricGrader || {
      role: "rubric-grader",
      provider: "OpenAI",
      model: "gpt-4.1-mini",
    },
  }

  await writeFile(opts.resultsPath, JSON.stringify(data, null, 2) + "\n", "utf8")

  if (opts.skipHistory) {
    console.log("Patched metadata only:", opts.resultsPath)
    return
  }

  const e2e = promptMetrics(data, "nellm-e2e")
  const plain = promptMetrics(data, "plain-base-model")

  const run = {
    evalId: data.evalId,
    timestamp: data.results.timestamp,
    model: opts.model,
    status: opts.status,
    notes: `Live benchmark ingest for ${opts.model}.`,
    totalTests: e2e.passCount + e2e.failCount,
    liveNellm: {
      label: `NELLM (${displayModel(opts.model)})`,
      passCount: e2e.passCount,
      failCount: e2e.failCount,
      score: avgScoreFromResults(data, "nellm-e2e"),
    },
    rawModel: {
      label: displayModel(opts.evalModel),
      passCount: plain.passCount,
      failCount: plain.failCount,
      score: avgScoreFromResults(data, "plain-base-model"),
    },
    categoryRows: buildCategoryRows(data),
  }

  const histPath = path.join(path.dirname(opts.resultsPath), "benchmark-history.json")
  const histRaw = await readFile(histPath, "utf8")
  const hist = JSON.parse(histRaw)

  hist.runs = hist.runs.filter((r) => r.model !== opts.model)
  hist.runs.push(run)
  hist.runs.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
  hist.lastCuratedAt = new Date().toISOString()

  await writeFile(histPath, JSON.stringify(hist, null, 2) + "\n", "utf8")
  console.log("Updated", opts.resultsPath, "and merged history for", opts.model)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
