import Link from "next/link"
import { ArrowLeft, Beaker, LineChart, Trophy } from "lucide-react"

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { BenchmarkHistory, BenchmarkProviderSummary, BenchmarkReport } from "@/lib/benchmark"
import { categoryDescription, getBenchmarkHistory, getBenchmarkReport } from "@/lib/benchmark"
import { cn } from "@/lib/utils"

export const metadata = {
  title: "Benchmark | Project Homeostasis",
  description: "Benchmark results comparing NELLM-wrapped models against raw model baselines.",
}

export const dynamic = "force-dynamic"

const providerTone = {
  "nellm-decision": "border-primary/30 bg-primary/5",
  "nellm-e2e": "border-primary/30 bg-primary/5",
  "plain-decision": "border-slate-500/30 bg-slate-500/5",
  "nellm-oracle": "border-amber-500/30 bg-amber-500/5",
  "plain-base-model": "border-slate-500/30 bg-slate-500/5",
  "plain-matched-decoding": "border-violet-500/30 bg-violet-500/5",
} as const

function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`
}

function discreetStamp(label: string, iso: string) {
  return (
    <p className="text-[10px] font-normal tracking-wide text-muted-foreground/60">
      {label} {new Date(iso).toLocaleString()}
    </p>
  )
}

type SnapshotBar = {
  key: string
  label: string
  passRate: number
  score: number
  providerKey: keyof typeof providerTone
}

type ComparisonColumn = {
  key: string
  label: string
  passRate: number
  score: number
  getStats: (category: BenchmarkReport["categorySummaries"][number]) => { pass: number; fail: number; avgScore?: number } | undefined
}

function comparePerformance(a: { passRate: number; score: number; label: string }, b: { passRate: number; score: number; label: string }) {
  return b.passRate - a.passRate || b.score - a.score || a.label.localeCompare(b.label)
}

function getComparableHistoryRuns(
  report: BenchmarkReport,
  history: BenchmarkHistory,
  publicProviders: BenchmarkProviderSummary[],
) {
  const currentLabels = new Set(publicProviders.map((provider) => provider.label))

  return history.runs.filter((run) => {
    const suiteOk = run.totalTests === report.totalTests
    if (!suiteOk) return false
    if (run.evalId === report.evalId) return false

    // Hide curated history rows that would duplicate the current live/raw pair on the page.
    return !(currentLabels.has(run.liveNellm.label) && currentLabels.has(run.rawModel.label))
  })
}

function buildSnapshotBars(historyRuns: BenchmarkHistory["runs"], publicProviders: BenchmarkProviderSummary[]): SnapshotBar[] {
  const bars: SnapshotBar[] = publicProviders.map((provider) => ({
    key: `current-${provider.id}`,
    label: provider.label,
    passRate: provider.passRate,
    score: provider.score,
    providerKey: provider.id as keyof typeof providerTone,
  }))

  for (const run of historyRuns) {
    const liveTotal = run.liveNellm.passCount + run.liveNellm.failCount
    const rawTotal = run.rawModel.passCount + run.rawModel.failCount
    bars.push({
      key: `hist-${run.evalId}-nellm`,
      label: run.liveNellm.label,
      passRate: liveTotal ? run.liveNellm.passCount / liveTotal : 0,
      score: run.liveNellm.score,
      providerKey: "nellm-e2e",
    })
    bars.push({
      key: `hist-${run.evalId}-raw`,
      label: run.rawModel.label,
      passRate: rawTotal ? run.rawModel.passCount / rawTotal : 0,
      score: run.rawModel.score,
      providerKey: "plain-base-model",
    })
  }

  return bars.sort(comparePerformance)
}

function categoryHistoryCell(stats: { pass: number; fail: number; avgScore?: number } | undefined) {
  if (!stats) {
    return <span className="text-xs text-muted-foreground">—</span>
  }
  const total = stats.pass + stats.fail
  return (
    <div className="space-y-1">
      <div className="font-medium text-foreground">
        {stats.pass}/{total}
      </div>
      {typeof stats.avgScore === "number" ? <div className="text-xs">avg {stats.avgScore.toFixed(2)}</div> : null}
    </div>
  )
}

function categoryTotal(category: BenchmarkReport["categorySummaries"][number]): number {
  return category.questionCount
}

function benchmarkRunPriority(model: string): number {
  const normalized = model.toLowerCase()

  if (normalized === "gpt-5.4") return 3
  if (normalized === "gpt-5") return 2
  if (normalized === "gpt-4o-mini") return 1

  return 0
}

export default async function BenchmarkPage() {
  const report = await getBenchmarkReport()
  const history = await getBenchmarkHistory()
  const sortedProviders = [...report.providerSummaries].sort((a, b) => b.score - a.score)
  const publicProviders = sortedProviders
  const bestProvider = publicProviders[0]
  const nellmE2E =
    report.providerSummaries.find((provider) => provider.id === "nellm-decision") ||
    report.providerSummaries.find((provider) => provider.id === "nellm-e2e")
  const baseModel =
    report.providerSummaries.find((provider) => provider.id === "plain-decision") ||
    report.providerSummaries.find((provider) => provider.id === "plain-base-model")
  const visibleBenchmarkRuns = history.runs
    .filter((run) => run.totalTests === report.totalTests)
    .sort((a, b) => {
      return (
        benchmarkRunPriority(b.model) - benchmarkRunPriority(a.model) ||
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      )
    })
  const latestVisibleRun = [...visibleBenchmarkRuns].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  )[0]
  const historyComparisonRuns = getComparableHistoryRuns(report, history, publicProviders)
  const snapshotBars = buildSnapshotBars(historyComparisonRuns, publicProviders).map((bar) => ({
    ...bar,
    chartPercent: Math.max(bar.passRate * 100, 8),
  }))
  const comparisonColumns: ComparisonColumn[] = [
    ...publicProviders.map((provider) => ({
      key: `current-${provider.id}`,
      label: provider.label,
      passRate: provider.passRate,
      score: provider.score,
      getStats: (category: BenchmarkReport["categorySummaries"][number]) => category.providers[provider.id],
    })),
    ...historyComparisonRuns.flatMap((run) => {
      const liveTotal = run.liveNellm.passCount + run.liveNellm.failCount
      const rawTotal = run.rawModel.passCount + run.rawModel.failCount
      return [
        {
          key: `history-${run.evalId}-nellm`,
          label: run.liveNellm.label,
          passRate: liveTotal ? run.liveNellm.passCount / liveTotal : 0,
          score: run.liveNellm.score,
          getStats: (category: BenchmarkReport["categorySummaries"][number]) =>
            run.categoryRows?.find((row) => row.key === category.key)?.liveNellm,
        },
        {
          key: `history-${run.evalId}-raw`,
          label: run.rawModel.label,
          passRate: rawTotal ? run.rawModel.passCount / rawTotal : 0,
          score: run.rawModel.score,
          getStats: (category: BenchmarkReport["categorySummaries"][number]) =>
            run.categoryRows?.find((row) => row.key === category.key)?.rawModel,
        },
      ]
    }),
  ].sort(comparePerformance)
  const bestComparisonColumnKey = comparisonColumns[0]?.key
  const suiteCategoryCount = report.categorySummaries.length
  const suiteCoverageIsStale = report.scoredQuestionCount < report.suiteQuestionCount

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-card/80 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 text-primary">
              <Beaker className="h-5 w-5" />
            </div>
            <div>
              <div className="text-sm font-semibold">Benchmark</div>
              <div className="text-xs text-muted-foreground">NELLM-wrapped models vs raw model baselines</div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link href="/benchmark/questions">Questions</Link>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link href="/leaderboard">Leaderboard</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/">
                <ArrowLeft className="h-4 w-4" />
                Back to Home
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto flex max-w-7xl flex-col gap-6 px-6 py-8">
        <section className="grid gap-4 lg:grid-cols-[1.45fr,1fr]">
          <Card className="border-primary/20 bg-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <LineChart className="h-5 w-5 text-primary" />
                Current Benchmark Readout
              </CardTitle>
              <CardDescription className="space-y-1">
                <span>
                  Latest eval: `{report.evalId}` run on {new Date(report.timestamp).toLocaleString()}
                </span>
                {discreetStamp("Snapshot file:", report.artifactModifiedAt)}
                {report.artifactSources.length > 1 ? (
                  <span className="block text-xs text-muted-foreground">
                    Merged sources: {report.artifactSources.map((source) => source.split("/").pop()).join(" + ")}
                  </span>
                ) : null}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-muted-foreground">
              <p>
                This benchmark compares the same base model in two conditions: plain chat versus NELLM, where sensory
                signals and endocrine-style state can change how the model reacts to risk, ambiguity, pressure, and
                recovery.
              </p>
              <p>
                The scenarios are workplace-shaped on purpose: a colleague asks for a shaky forecast, a boss pushes an
                unsafe shortcut, evidence changes midstream, or a prior mistake should make the next decision more
                cautious. We are testing whether NELLM adds useful judgment, including intelligent disobedience and more
                nuanced handling of authority and trust.
              </p>
              <p>
                The benchmark only matters if it exposes both strengths and weaknesses. When both systems get perfect
                scores, that slice is functioning more as a regression check than as evidence that we are measuring the
                real benefit of an endocrine system.
              </p>
              <div className="grid gap-3 sm:grid-cols-4">
                <div className="rounded-xl border border-border bg-background/50 p-4">
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">Best Current Score</div>
                  <div className="mt-2 text-2xl font-semibold text-foreground">
                    {bestProvider?.score != null ? bestProvider.score.toFixed(2) : "—"}
                  </div>
                  <div className="text-xs text-muted-foreground">{bestProvider?.label ?? "—"}</div>
                </div>
                <div className="rounded-xl border border-border bg-background/50 p-4">
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">Live NELLM</div>
                  <div className="mt-2 text-2xl font-semibold text-foreground">
                    {nellmE2E?.passCount}/{(nellmE2E?.passCount || 0) + (nellmE2E?.failCount || 0)}
                  </div>
                  <div className="text-xs text-muted-foreground">Live-system pass count</div>
                </div>
                <div className="rounded-xl border border-border bg-background/50 p-4">
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">Baseline</div>
                  <div className="mt-2 text-2xl font-semibold text-foreground">
                    {baseModel?.passCount}/{(baseModel?.passCount || 0) + (baseModel?.failCount || 0)}
                  </div>
                  <div className="text-xs text-muted-foreground">{baseModel?.label}</div>
                </div>
                <div className="rounded-xl border border-border bg-background/50 p-4">
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">Suite Coverage</div>
                  <div className="mt-2 text-2xl font-semibold text-foreground">
                    {report.scoredQuestionCount}/{report.suiteQuestionCount}
                  </div>
                  <div className="text-xs text-muted-foreground">Scenarios included in this published comparison</div>
                </div>
              </div>
              {suiteCoverageIsStale ? (
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100">
                  `eval/tests/decisions.yaml` now defines {report.suiteQuestionCount} cases across {suiteCategoryCount} families,
                  but the latest saved eval artifact covers {report.scoredQuestionCount}. Re-run the decision benchmark to refresh
                  the scored charts for the newly added cases.
                </div>
              ) : null}
              {latestVisibleRun?.status === "provisional" ? (
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100">
                  The latest curated history entry is marked provisional. Treat it as diagnostic until the harness and API
                  path are confirmed stable for that model.
                </div>
              ) : null}
            </CardContent>
          </Card>
        </section>

        <section>
          <Card>
            <CardHeader>
              <CardTitle>Live Model Comparison</CardTitle>
              <CardDescription className="space-y-1">
                <span>
                  These rows compare public runs on the same scenario count so the differences reflect behavior, not
                  benchmark size.
                </span>
                {history.lastCuratedAt ? discreetStamp("History curated:", history.lastCuratedAt) : null}
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              {visibleBenchmarkRuns.map((run) => (
                <div key={run.evalId} className="rounded-2xl border border-border bg-background/50 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-lg font-semibold text-foreground">{run.model.toUpperCase()}</div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(run.timestamp).toLocaleString()} | {run.totalTests} tests
                      </div>
                    </div>
                    <div
                      className={cn(
                        "rounded-full px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide",
                        run.status === "stable"
                          ? "bg-emerald-500/15 text-emerald-300"
                          : "bg-amber-500/15 text-amber-200",
                      )}
                    >
                      {run.status}
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl border border-border bg-card/60 p-4">
                      <div className="text-xs uppercase tracking-wide text-muted-foreground">{run.liveNellm.label}</div>
                      <div className="mt-2 text-2xl font-semibold text-foreground">
                        {run.liveNellm.passCount}/{run.liveNellm.passCount + run.liveNellm.failCount}
                      </div>
                      <div className="text-xs text-muted-foreground">avg score {run.liveNellm.score.toFixed(3)}</div>
                    </div>
                    <div className="rounded-xl border border-border bg-card/60 p-4">
                      <div className="text-xs uppercase tracking-wide text-muted-foreground">{run.rawModel.label}</div>
                      <div className="mt-2 text-2xl font-semibold text-foreground">
                        {run.rawModel.passCount}/{run.rawModel.passCount + run.rawModel.failCount}
                      </div>
                      <div className="text-xs text-muted-foreground">avg score {run.rawModel.score.toFixed(3)}</div>
                    </div>
                  </div>

                  <p className="mt-4 text-sm text-muted-foreground">{run.notes}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </section>

        <section>
          <Card className="overflow-hidden border-border bg-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="h-5 w-5 text-primary" />
                Workplace Judgment Under Pressure
              </CardTitle>
              <CardDescription className="space-y-1">
                <span>
                  This chart summarizes performance on the NELLM decision benchmark: multi-turn workplace scenarios that
                  test ambiguity handling, high- vs low-stakes judgment, recovery after mistakes, updating on new
                  evidence, and resistance to social pressure from peers, bosses, and other authority signals.
                </span>
                {discreetStamp("Snapshot file:", report.artifactModifiedAt)}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <div className="min-w-[760px] rounded-[2rem] border border-border bg-background/70 px-4 py-6 sm:px-8">
                  <div className="text-center">
                    <div className="text-2xl font-semibold text-foreground sm:text-3xl">NELLM Benchmark</div>
                    <p className="mt-1 text-sm text-muted-foreground">Safety refusal · sycophancy resistance · judgment · epistemic calibration</p>
                    <p className="mt-2 text-[11px] text-muted-foreground/80">
                      Eval recorded: {new Date(report.timestamp).toLocaleString()}
                    </p>
                  </div>

                  <div
                    className="mt-8 grid gap-3 sm:gap-5"
                    style={{ gridTemplateColumns: `2.25rem repeat(${snapshotBars.length}, minmax(0, 1fr))` }}
                  >
                    <div className="flex h-72 flex-col justify-between pb-12 text-[10px] uppercase tracking-wide text-muted-foreground">
                      <span>100</span>
                      <span>75</span>
                      <span>50</span>
                      <span>25</span>
                      <span>0</span>
                    </div>

                    {snapshotBars.map((bar) => (
                      <div key={bar.key} className="flex h-72 flex-col justify-end gap-3">
                        <div className="relative flex-1 rounded-2xl border border-border/60 bg-muted/20">
                          <div className="absolute inset-x-0 top-[25%] border-t border-dashed border-border/60" />
                          <div className="absolute inset-x-0 top-[50%] border-t border-dashed border-border/60" />
                          <div className="absolute inset-x-0 top-[75%] border-t border-dashed border-border/60" />
                          <div
                            className={cn(
                              "absolute inset-x-3 bottom-0 rounded-t-[1.25rem] border border-b-0",
                              providerTone[bar.providerKey],
                            )}
                            style={{ height: `${bar.chartPercent}%` }}
                          >
                            <div className="absolute -top-8 left-1/2 -translate-x-1/2 text-sm font-semibold text-foreground">
                              {formatPercent(bar.passRate)}
                            </div>
                          </div>
                        </div>
                        <div className="space-y-1 text-center">
                          <div className="text-xs font-medium text-foreground">{bar.label}</div>
                          <div className="text-[11px] text-muted-foreground">{bar.score.toFixed(2)} score</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        <section>
          <Card>
            <CardHeader>
              <CardTitle>Category Comparison</CardTitle>
              <CardDescription className="space-y-1">
                <span>
                  Each row is a family of work decisions where current LLMs often struggle: resisting bad pressure,
                  asking for the missing fact instead of bluffing, updating when the world changes, and recovering after
                  a mistake. We use these slices to test whether NELLM is objectively stronger than the same model
                  without endocrine state.
                </span>
                {discreetStamp("Snapshot file:", report.artifactModifiedAt)}
              </CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full min-w-[960px] text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="pb-3 pr-4 font-medium">Category</th>
                    {comparisonColumns.map((column) => (
                      <th
                        key={column.key}
                        className={cn(
                          "pb-3 pr-4 font-medium",
                          column.key === bestComparisonColumnKey && "bg-primary/10 text-primary",
                        )}
                      >
                        <div className="font-normal normal-case tracking-normal text-muted-foreground">{column.label}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {report.categorySummaries.map((category) => (
                    <tr key={category.key} className="border-b border-border/60 align-top">
                      <td className="py-3 pr-4">
                        <div className="font-medium text-foreground">{category.label}</div>
                        <div className="max-w-xs text-xs text-muted-foreground">{categoryDescription(category.key)}</div>
                        <div className="text-xs text-muted-foreground">{categoryTotal(category)} cases</div>
                      </td>
                      {comparisonColumns.map((column) => (
                        <td
                          key={`${column.key}-${category.key}`}
                          className={cn(
                            "py-3 pr-4 text-muted-foreground",
                            column.key === bestComparisonColumnKey && "bg-primary/5",
                          )}
                        >
                          {categoryHistoryCell(column.getStats(category))}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </section>

        <section>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Methodology</CardTitle>
              <CardDescription>
                How the benchmark is designed to measure useful workplace judgment rather than generic chatbot fluency.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <p>
                Every public row compares two systems on the same structured decision cases: live `NELLM(model)` and the
                same underlying model without the endocrine wrapper. Cases are written around work-relevant conditions
                where raw LLMs often fail in practice: over-deference, fake certainty, brittle updates, or poor recovery
                after an earlier miss.
              </p>
              <p>
                The suite mixes 1-turn, 2-turn, and 3-turn cases on purpose. Single-turn cases test clean boundaries like
                immediate escalation or bluff resistance. Two-turn cases test one meaningful update. Three-turn cases are
                reserved for full trajectories such as proceed, then tighten, then recover.
              </p>
              <p>
                Each case is scored deterministically on action quality and whether the model updates correctly when the
                situation changes. Confidence is tracked as a warning signal when relevant, but the benchmark is meant to
                center judgment quality first.
                The scorer for this snapshot is `{report.rubricGrader.provider} / {report.rubricGrader.model}`. Failures
                are tagged as `wrong_action`, `overconfident`, `too_cautious`, `missed_escalation`, or
                `ignored_new_evidence`.
              </p>
              <p>
                Curated cross-model snapshots for the same suite size are kept in `eval/benchmark-history.json` so new
                runs do not erase prior comparisons. Entries show both the display label and the harness/provider wiring
                behind each column.
              </p>
            </CardContent>
          </Card>
        </section>

        <section>
          <Card>
            <CardHeader>
              <CardTitle>Benchmark FAQ / Disclaimer</CardTitle>
              <CardDescription>
                How the official public harness is interpreted on this page. Research prototype; not a universal
                safety or capability score.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Accordion type="single" collapsible className="w-full">
                <AccordionItem value="what-is-being-compared">
                  <AccordionTrigger>What exactly is being compared?</AccordionTrigger>
                  <AccordionContent className="space-y-2 text-sm text-muted-foreground">
                    <p>
                      Each comparison uses the same underlying model in two conditions: the baseline model on its own, and
                      the same model wrapped inside NELLM. That lets this benchmark ask a narrower question than a normal
                      leaderboard: does the endocrine layer improve workplace judgment?
                    </p>
                    <p>
                      The cases are work-shaped on purpose: unclear requests, pressure from a boss or teammate, changing
                      evidence, cheap reversible choices, high-stakes calls, and recovery after an earlier miss. Public
                      pages focus on the side-by-side comparison that matters most and leave out internal diagnostic
                      providers.
                    </p>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="how-scoring-works">
                  <AccordionTrigger>How are responses scored?</AccordionTrigger>
                  <AccordionContent className="space-y-2 text-sm text-muted-foreground">
                    <p>
                      Each case defines the situation, the allowed actions, and what counts as the right move as the
                      scenario unfolds. Models are scored on whether they make the right decision at the right time.
                    </p>
                    <p>
                      In multi-turn cases, the benchmark also checks whether the model updates correctly when new evidence
                      appears. Confidence can generate a warning when it is too high for the situation, but the main score
                      is centered on judgment quality rather than style.
                    </p>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="where-data-comes-from">
                  <AccordionTrigger>Where do these numbers come from?</AccordionTrigger>
                  <AccordionContent className="space-y-2 text-sm text-muted-foreground">
                    <p>
                      Case definitions come from `eval/tests/decisions.yaml`. Scores come from the latest checked-in
                      `eval/comprehensive-results.json` produced by `npm run eval:benchmark`.
                    </p>
                    <p>
                      Model names, eval id, and timestamps are read from that artifact so this page reflects the saved
                      run. Historical bars and category columns can additionally pull from `eval/benchmark-history.json`
                      when curated entries match the current suite size.
                    </p>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="limitations">
                  <AccordionTrigger>What are the main limitations of this benchmark?</AccordionTrigger>
                  <AccordionContent className="space-y-2 text-sm text-muted-foreground">
                    <p>
                      This is a focused research benchmark, not a universal measure of intelligence, safety, or product
                      quality. It is designed around one specific claim: that NELLM should improve judgment in workplace
                      conditions where current LLMs are often weak.
                    </p>
                    <p>
                      Results still depend on case design, scoring rules, and implementation details. A strong result here
                      means the system handled these work decisions better on this benchmark, not that it is automatically
                      better at every task outside this setting.
                    </p>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </CardContent>
          </Card>
        </section>
      </main>
    </div>
  )
}
