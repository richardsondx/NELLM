import Link from "next/link"
import { ArrowLeft, Beaker, Layers3, Medal, Trophy } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { getBenchmarkHistory, getBenchmarkReport } from "@/lib/benchmark"
import { cn } from "@/lib/utils"

export const metadata = {
  title: "Leaderboard | Project Homeostasis",
  description: "AI-arena-style leaderboard for NELLM benchmark systems.",
}

export const dynamic = "force-dynamic"

const podiumTone = [
  "border-amber-500/30 bg-amber-500/8",
  "border-slate-400/30 bg-slate-400/8",
  "border-orange-500/30 bg-orange-500/8",
]

function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`
}

function formatLatency(value: number): string {
  return `${(value / 1000).toFixed(1)}s`
}

function formatRole(role: string): string {
  return role.replace(/-/g, " ").replace(/\b\w/g, (character) => character.toUpperCase())
}

function discreetStamp(label: string, iso: string) {
  return (
    <p className="text-[10px] font-normal tracking-wide text-muted-foreground/60">
      {label} {new Date(iso).toLocaleString()}
    </p>
  )
}

type LeaderboardEntry = {
  key: string
  source: "Current" | "History"
  label: string
  score: number
  passRate: number
  total: number
  latencyMs: number | null
  implementation: string
  backendSummary: string
  modelReferences: Array<{ role: string; provider: string; model: string }>
  categoryStats: Record<string, { pass: number; fail: number; avgScore?: number }>
}

function comparePerformance(a: { passRate: number; score: number; label: string }, b: { passRate: number; score: number; label: string }) {
  return b.passRate - a.passRate || b.score - a.score || a.label.localeCompare(b.label)
}

export default async function LeaderboardPage() {
  const report = await getBenchmarkReport()
  const history = await getBenchmarkHistory()
  const currentProviders = [...report.providerSummaries].filter(
    (provider) => provider.id !== "nellm-oracle" && provider.id !== "plain-matched-decoding",
  )
  const currentEntries: LeaderboardEntry[] = currentProviders.map((provider) => ({
    key: `current-${provider.id}`,
    source: "Current",
    label: provider.label,
    score: provider.score,
    passRate: provider.passRate,
    total: provider.passCount + provider.failCount + provider.errorCount,
    latencyMs: provider.latencyMs,
    implementation: provider.implementation,
    backendSummary: provider.backendSummary,
    modelReferences: provider.modelReferences,
    categoryStats: Object.fromEntries(
      report.categorySummaries.flatMap((category) => {
        const stats = category.providers[provider.id]
        return stats ? [[category.key, stats]] : []
      }),
    ),
  }))
  const historyEntries: LeaderboardEntry[] = history.runs
    .filter((run) => run.evalId !== report.evalId && run.totalTests === report.totalTests)
    .flatMap((run) => {
      const liveTotal = run.liveNellm.passCount + run.liveNellm.failCount
      const rawTotal = run.rawModel.passCount + run.rawModel.failCount
      return [
        {
          key: `history-${run.evalId}-nellm`,
          source: "History" as const,
          label: run.liveNellm.label,
          score: run.liveNellm.score,
          passRate: liveTotal ? run.liveNellm.passCount / liveTotal : 0,
          total: liveTotal,
          latencyMs: null,
          implementation: "Curated historical live NELLM run.",
          backendSummary: `sensory: OpenAI / ${run.model} | response: OpenAI / ${run.model}`,
          modelReferences: [
            { role: "sensory", provider: "OpenAI", model: run.model },
            { role: "response", provider: "OpenAI", model: run.model },
          ],
          categoryStats: Object.fromEntries((run.categoryRows || []).map((row) => [row.key, row.liveNellm])),
        },
        {
          key: `history-${run.evalId}-raw`,
          source: "History" as const,
          label: run.rawModel.label,
          score: run.rawModel.score,
          passRate: rawTotal ? run.rawModel.passCount / rawTotal : 0,
          total: rawTotal,
          latencyMs: null,
          implementation: "Curated historical raw-model baseline run.",
          backendSummary: `response: OpenAI / ${run.model}`,
          modelReferences: [{ role: "response", provider: "OpenAI", model: run.model }],
          categoryStats: Object.fromEntries((run.categoryRows || []).map((row) => [row.key, row.rawModel])),
        },
      ]
    })
  const rankedEntries = [...currentEntries, ...historyEntries].sort(comparePerformance)
  const podium = rankedEntries.slice(0, 3)
  const suiteCoverageIsStale = report.scoredQuestionCount < report.suiteQuestionCount

  const categoryLeaders = report.categorySummaries.map((category) => {
    const ranked = rankedEntries
      .map((entry) => {
        const stats = entry.categoryStats[category.key]
        if (!stats) return null
        return {
          entry,
          passRate: (stats.pass + stats.fail) > 0 ? stats.pass / (stats.pass + stats.fail) : 0,
          avgScore: stats.avgScore ?? 0,
          pass: stats.pass,
          total: stats.pass + stats.fail,
        }
      })
      .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
      .sort((a, b) => b.passRate - a.passRate || b.avgScore - a.avgScore || a.entry.label.localeCompare(b.entry.label))

    return {
      category: category.label,
      leader: ranked[0],
    }
  })

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-card/80 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 text-primary">
              <Trophy className="h-5 w-5" />
            </div>
            <div>
              <div className="text-sm font-semibold">Leaderboard</div>
              <div className="text-xs text-muted-foreground">Arena-style ranking of current benchmark systems</div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link href="/benchmark/questions">Questions</Link>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link href="/benchmark">Benchmark</Link>
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
        <section className="grid gap-4 lg:grid-cols-[1.3fr,1fr]">
          <Card className="border-primary/20 bg-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <Layers3 className="h-5 w-5 text-primary" />
                Live Arena View
              </CardTitle>
              <CardDescription className="space-y-1">
                <span>
                  Ranked from the latest eval `{report.evalId}` on {new Date(report.timestamp).toLocaleString()}
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
                This leaderboard ranks who handles the same workplace decision benchmark more reliably: `NELLM(model)`
                systems with endocrine state, the unwrapped baseline, and archived comparison runs from the same suite.
              </p>
              <p>
                Higher is better. `Score` is the average benchmark score on a `0.00` to `1.00` scale, while pass rate is
                the share of scenarios where the system chose a valid action and updated correctly as the situation
                changed.
              </p>
              <p>
                The fixed fixture state provider is intentionally excluded from this public leaderboard because it is a
                diagnostic setup, not the way users interact with NELLM.
              </p>
              <div className="grid gap-3 sm:grid-cols-4">
                <div className="rounded-xl border border-border bg-background/55 p-4">
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">Current Leader</div>
                  <div className="mt-2 text-lg font-semibold text-foreground">{rankedEntries[0]?.label}</div>
                  <div className="text-xs text-muted-foreground">{rankedEntries[0]?.score.toFixed(2)} avg score</div>
                </div>
                <div className="rounded-xl border border-border bg-background/55 p-4">
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">Suite Coverage</div>
                  <div className="mt-2 text-lg font-semibold text-foreground">
                    {report.scoredQuestionCount}/{report.suiteQuestionCount}
                  </div>
                  <div className="text-xs text-muted-foreground">Scenarios currently represented in this ranking</div>
                </div>
                <div className="rounded-xl border border-border bg-background/55 p-4">
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">Scorer</div>
                  <div className="mt-2 text-lg font-semibold text-foreground">
                    {report.rubricGrader.provider} / {report.rubricGrader.model}
                  </div>
                  <div className="text-xs text-muted-foreground">Deterministic judge, not ranked as an entrant</div>
                </div>
                <div className="rounded-xl border border-border bg-background/55 p-4">
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">Systems Ranked</div>
                  <div className="mt-2 text-lg font-semibold text-foreground">{rankedEntries.length}</div>
                  <div className="text-xs text-muted-foreground">{report.totalTests} scored scenarios in the latest saved run</div>
                </div>
              </div>
              {suiteCoverageIsStale ? (
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100">
                  The leaderboard is still ranked from the latest saved artifact (`{report.scoredQuestionCount}` scored
                  questions), while the current suite definition contains `{report.suiteQuestionCount}` questions.
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Beaker className="h-5 w-5 text-emerald-400" />
                Comparison Rule
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p>
                The benchmark is meant to answer one question cleanly: does NELLM make the same model better at judgment
                under pressure, ambiguity, and changing evidence?
              </p>
              <p>
                Every row still shows the underlying provider and model stack so the comparison stays objective when new
                model variants are added later.
              </p>
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-4 lg:grid-cols-3">
          {podium.map((entry, index) => (
            <Card key={entry.key} className={cn("border", podiumTone[index] || "border-border")}>
              <CardHeader>
                <CardDescription>Rank #{index + 1}</CardDescription>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Medal className="h-5 w-5 text-primary" />
                  {entry.label}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="text-3xl font-semibold text-foreground">{entry.score.toFixed(2)}</div>
                <div className="text-muted-foreground">{formatPercent(entry.passRate)} pass rate</div>
                <div className="rounded-xl border border-border bg-background/55 p-3 text-xs text-muted-foreground">
                  {entry.backendSummary}
                </div>
              </CardContent>
            </Card>
          ))}
        </section>

        <section>
          <Card>
            <CardHeader>
              <CardTitle>Arena Table</CardTitle>
              <CardDescription className="space-y-1">
                <span>Exact ranked systems, mixing the latest official run with curated historical runs on comparable workplace-decision coverage.</span>
                {discreetStamp("Snapshot file:", report.artifactModifiedAt)}
              </CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full min-w-[980px] text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="pb-3 pr-4 font-medium">Rank</th>
                    <th className="pb-3 pr-4 font-medium">System</th>
                    <th className="pb-3 pr-4 font-medium">Score</th>
                    <th className="pb-3 pr-4 font-medium">Pass Rate</th>
                    <th className="pb-3 pr-4 font-medium">Tests</th>
                    <th className="pb-3 pr-4 font-medium">Latency</th>
                    <th className="pb-3 pr-4 font-medium">Actual Provider / Model</th>
                  </tr>
                </thead>
                <tbody>
                  {rankedEntries.map((entry, index) => {
                    return (
                      <tr key={entry.key} className="border-b border-border/60 align-top">
                        <td className="py-4 pr-4 font-semibold text-foreground">#{index + 1}</td>
                        <td className="py-4 pr-4">
                          <div className="font-medium text-foreground">{entry.label}</div>
                          <div className="mt-1 text-xs text-muted-foreground">{entry.implementation}</div>
                          <div className="mt-1 text-[11px] text-muted-foreground">
                            {entry.source === "Current" ? "Latest artifact" : "Curated history"}
                          </div>
                        </td>
                        <td className="py-4 pr-4 font-medium text-foreground">{entry.score.toFixed(2)}</td>
                        <td className="py-4 pr-4 text-foreground">{formatPercent(entry.passRate)}</td>
                        <td className="py-4 pr-4 text-foreground">{entry.total}</td>
                        <td className="py-4 pr-4 text-foreground">{entry.latencyMs == null ? "—" : formatLatency(entry.latencyMs)}</td>
                        <td className="py-4 pr-4">
                          <div className="space-y-2">
                            {entry.modelReferences.map((reference) => (
                              <div
                                key={`${entry.key}-${reference.role}-${reference.provider}-${reference.model}`}
                                className="flex flex-wrap items-center gap-2 text-xs"
                              >
                                <span className="rounded-full bg-secondary px-2 py-1 font-medium text-foreground">
                                  {formatRole(reference.role)}
                                </span>
                                <span className="text-muted-foreground">{reference.provider}</span>
                                <span className="font-mono text-foreground">{reference.model}</span>
                              </div>
                            ))}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </section>

        <section>
          <Card>
            <CardHeader>
              <CardTitle>Category Leaders</CardTitle>
              <CardDescription>Best scored system for each benchmark slice, showing where NELLM or the baseline currently looks stronger.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {categoryLeaders.map(({ category, leader }) => (
                <div key={category} className="rounded-xl border border-border bg-background/55 p-4 text-sm">
                  <div className="font-medium text-foreground">{category}</div>
                  {leader ? (
                    <div className="mt-2 text-muted-foreground">
                      <span className="font-medium text-foreground">{leader.entry.label}</span> at{" "}
                      <span className="font-medium text-foreground">{formatPercent(leader.passRate)}</span> ({leader.pass}/
                      {leader.total})
                    </div>
                  ) : (
                    <div className="mt-2 text-muted-foreground">No data</div>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        </section>
      </main>
    </div>
  )
}
