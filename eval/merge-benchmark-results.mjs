/**
 * Merges promptfoo result JSONs by provider::description::message key.
 * Usage: node eval/merge-benchmark-results.mjs
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs"
import path from "node:path"

const root = process.cwd()

function key(r) {
  return `${r.provider.id}::${r.testCase.description}::${r.testCase.vars.message}`
}

function load(p) {
  return JSON.parse(readFileSync(path.join(root, p), "utf8"))
}

const base = load("eval/comprehensive-results.json")
const patchPath = path.join(root, "eval/comprehensive-results-patched-categories.json")
const patch = existsSync(patchPath)
  ? load("eval/comprehensive-results-patched-categories.json")
  : { nellmMetadata: {}, results: { prompts: [], results: [] } }
const jut = load("eval/jut-results.json")

const merged = new Map(base.results.results.map((r) => [key(r), r]))
for (const r of patch.results.results) merged.set(key(r), r)
for (const r of jut.results.results) merged.set(key(r), r)

const all = Array.from(merged.values())

function mergePrompts(basePrompts, overlays) {
  const m = new Map(basePrompts.map((p) => [p.provider, structuredClone(p)]))
  for (const layer of overlays) {
    for (const p of layer.results.prompts) {
      m.set(p.provider, structuredClone(p))
    }
  }
  return m
}

const promptMap = mergePrompts(base.results.prompts, [patch, jut])
const providerIds = [...new Set(all.map((r) => r.provider.id))]

for (const pid of providerIds) {
  const rows = all.filter((r) => r.provider.id === pid)
  let score = 0
  let pass = 0
  let fail = 0
  let lat = 0
  for (const r of rows) {
    score += r.score ?? 0
    if (r.success) pass += 1
    else fail += 1
    lat += r.latencyMs ?? 0
  }
  const prompt = promptMap.get(pid)
  if (!prompt) continue
  prompt.metrics.score = score
  prompt.metrics.testPassCount = pass
  prompt.metrics.testFailCount = fail
  prompt.metrics.testErrorCount = 0
  prompt.metrics.totalLatencyMs = lat
  if (prompt.metrics.tokenUsage) {
    prompt.metrics.tokenUsage.numRequests = rows.length
  }
}

const out = {
  ...base,
  evalId: jut.evalId || base.evalId,
  nellmMetadata: {
    ...(base.nellmMetadata || {}),
    ...(patch.nellmMetadata || {}),
    ...(jut.nellmMetadata || {}),
  },
  results: {
    ...base.results,
    timestamp: new Date().toISOString(),
    prompts: Array.from(promptMap.values()),
    results: all,
  },
}

writeFileSync(path.join(root, "eval/comprehensive-results.json"), `${JSON.stringify(out, null, 2)}\n`)
