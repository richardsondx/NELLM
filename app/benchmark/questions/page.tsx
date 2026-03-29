import Link from "next/link"
import { ArrowLeft, ClipboardList, Trophy } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { categoryDescription, getBenchmarkReport } from "@/lib/benchmark"

export const metadata = {
  title: "Benchmark Cases | Project Homeostasis",
  description: "All decision benchmark cases with per-model scores from the latest saved run.",
}

export const dynamic = "force-dynamic"

function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`
}

function formatFixture(value: string): string {
  return value.replace(/_/g, " ").replace(/\b\w/g, (character) => character.toUpperCase())
}

function discreetStamp(label: string, iso: string) {
  return (
    <p className="text-[10px] font-normal tracking-wide text-muted-foreground/60">
      {label} {new Date(iso).toLocaleString()}
    </p>
  )
}

function formatConfidence(value: number): string {
  return `${Math.round(value * 100)}%`
}

function formatExpectedActions(actions: string[]): string {
  if (actions.length === 0) return "No turn-specific expected actions recorded."
  if (actions.length === 1) return actions[0]
  if (actions.length === 2) return `${actions[0]} or ${actions[1]}`
  return `${actions.slice(0, -1).join(", ")}, or ${actions[actions.length - 1]}`
}

function formatWarningLabel(tag: string): string {
  return tag.replace(/_/g, " ")
}

function formatWarningExplanation(reason: string): string {
  const match = reason.match(
    /^warning:(overconfident):\s*turn\s+(\d+)\s+confidence\s+([0-9.]+)\s+exceeded\s+([0-9.]+)$/i,
  )
  if (!match) return reason.replace(/^warning:/i, "")

  const [, tag, turn, confidence, threshold] = match
  if (tag.toLowerCase() !== "overconfident") return reason.replace(/^warning:/i, "")

  return `Turn ${turn} confidence was ${formatConfidence(Number(confidence))}, above the ${formatConfidence(Number(threshold))} cap for this case.`
}

export default async function BenchmarkQuestionsPage() {
  const report = await getBenchmarkReport()
  const publicProviders = report.providerSummaries.filter(
    (provider) => provider.id !== "nellm-oracle" && provider.id !== "plain-matched-decoding",
  )
  const publicProviderIds = new Set(publicProviders.map((provider) => provider.id))
  const questions = report.questions.map((question) => ({
    ...question,
    scores: question.scores.filter((score) => publicProviderIds.has(score.providerId)),
  }))
  const groupedQuestions = report.categorySummaries
    .map((summary) => ({
      ...summary,
      questions: questions.filter((question) => question.categoryKey === summary.key),
    }))
    .filter((group) => group.questions.length > 0)
  const suiteCoverageIsStale = report.scoredQuestionCount < report.suiteQuestionCount

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-card/80 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 text-primary">
              <ClipboardList className="h-5 w-5" />
            </div>
            <div>
              <div className="text-sm font-semibold">Benchmark Cases</div>
              <div className="text-xs text-muted-foreground">Every decision case in the latest benchmark, with per-model scores</div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link href="/benchmark">Benchmark</Link>
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
        <section className="grid gap-4 lg:grid-cols-[1.35fr,1fr]">
          <Card className="border-primary/20 bg-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <ClipboardList className="h-5 w-5 text-primary" />
                What This Benchmark Measures
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
                This benchmark tests how models behave in realistic workplace situations where judgment matters:
                ambiguous requests, new evidence, social pressure, low-stakes tasks, high-stakes risk, and recovery
                after mistakes.
              </p>
              <p>
                The goal is to compare a NELLM against a standard LLM on the same work-related decisions and see which
                one shows better judgment, better recalibration, and stronger intelligent disobedience when pressure or
                incomplete information could lead to the wrong call.
              </p>
              <div className="grid gap-3 sm:grid-cols-4">
                <div className="rounded-xl border border-border bg-background/55 p-4">
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">Cases</div>
                  <div className="mt-2 text-2xl font-semibold text-foreground">{questions.length}</div>
                </div>
                <div className="rounded-xl border border-border bg-background/55 p-4">
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">Scored In Artifact</div>
                  <div className="mt-2 text-2xl font-semibold text-foreground">{report.scoredQuestionCount}</div>
                </div>
                <div className="rounded-xl border border-border bg-background/55 p-4">
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">Compared Models</div>
                  <div className="mt-2 text-2xl font-semibold text-foreground">{publicProviders.length}</div>
                </div>
                <div className="rounded-xl border border-border bg-background/55 p-4">
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">Categories</div>
                  <div className="mt-2 text-2xl font-semibold text-foreground">{report.categorySummaries.length}</div>
                </div>
              </div>
              {suiteCoverageIsStale ? (
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100">
                  The latest saved eval scores {report.scoredQuestionCount}/{report.suiteQuestionCount} suite questions. Any
                  row without model scores below is defined in the benchmark but has not been refreshed in the checked-in
                  artifact yet.
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex select-text items-center gap-2 text-lg">
                <Trophy className="h-5 w-5 text-emerald-400" />
                Current Compared Systems
              </CardTitle>
              <CardDescription>Aggregate full-suite results for the models shown in the question table below.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {publicProviders.map((provider) => (
                <div key={provider.id} className="rounded-xl border border-border bg-background/55 p-4 text-sm">
                  <div className="font-medium text-foreground">{provider.label}</div>
                  <div className="mt-2 flex flex-wrap gap-4 text-muted-foreground">
                    <span>
                      <span className="font-medium text-foreground">{provider.score.toFixed(2)}</span> aggregate score
                    </span>
                    <span>
                      <span className="font-medium text-foreground">{formatPercent(provider.passRate)}</span> pass rate
                    </span>
                    <span>
                      <span className="font-medium text-foreground">
                        {provider.passCount}/{provider.passCount + provider.failCount + provider.errorCount}
                      </span>{" "}
                      tests
                    </span>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </section>

        <section className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>NELLM Benchmark Category Comparison</CardTitle>
              <CardDescription>
                Cases are grouped by decision family so you can compare model behavior within each area.
              </CardDescription>
            </CardHeader>
          </Card>

          {groupedQuestions.map((group) => (
            <Card key={group.key}>
              <CardHeader>
                <CardTitle className="text-lg">{group.label}</CardTitle>
                <CardDescription className="space-y-1">
                  <span>{group.questions.length} benchmark cases in this family.</span>
                  <span className="block">{categoryDescription(group.key)}</span>
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 lg:grid-cols-3">
                  {publicProviders.map((provider) => {
                    const categoryStats = group.providers[provider.id]
                    const total = (categoryStats?.pass || 0) + (categoryStats?.fail || 0)

                    return (
                      <div key={`${group.key}-${provider.id}`} className="rounded-xl border border-border bg-background/55 p-4 text-sm">
                        <div className="font-medium text-foreground">{provider.label}</div>
                        {categoryStats ? (
                          <div className="mt-2 flex flex-wrap gap-4 text-muted-foreground">
                            <span>
                              <span className="font-medium text-foreground">{categoryStats.avgScore.toFixed(2)}</span> avg score
                            </span>
                            <span>
                              <span className="font-medium text-foreground">
                                {total > 0 ? formatPercent(categoryStats.pass / total) : "0%"}
                              </span>{" "}
                              pass rate
                            </span>
                            <span>
                              <span className="font-medium text-foreground">{categoryStats.pass}</span> / {total} passed
                            </span>
                          </div>
                        ) : (
                          <div className="mt-2 text-muted-foreground">No results for this category.</div>
                        )}
                      </div>
                    )
                  })}
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full min-w-[1180px] text-sm">
                    <thead>
                      <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                        <th className="pb-3 pr-4 font-medium">Case</th>
                        <th className="pb-3 pr-4 font-medium">Fixture</th>
                        <th className="pb-3 pr-4 font-medium">Scenario</th>
                        <th className="pb-3 pr-4 font-medium">Actions / Expectation</th>
                        {publicProviders.map((provider) => (
                          <th key={provider.id} className="pb-3 pr-4 font-medium">
                            <div className="normal-case tracking-normal text-muted-foreground">{provider.label}</div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {group.questions.map((question) => (
                        <tr key={question.id} className="border-b border-border/60 align-top">
                          <td className="py-4 pr-4">
                        <div className="font-medium text-foreground">{question.description}</div>
                        <div className="mt-1 text-xs text-muted-foreground">{question.turnCount} turn{question.turnCount === 1 ? "" : "s"}</div>
                            {question.shouldBeBrief ? (
                              <div className="mt-2 inline-flex rounded-full bg-amber-500/10 px-2 py-1 text-[11px] text-amber-300">
                                Brief response expected
                              </div>
                            ) : null}
                          </td>
                          <td className="py-4 pr-4 text-foreground">{formatFixture(question.fixture)}</td>
                          <td className="py-4 pr-4">
                            <div className="max-w-md whitespace-pre-wrap text-foreground">{question.scenario || question.message}</div>
                          </td>
                          <td className="py-4 pr-4">
                            <div className="max-w-sm space-y-2 text-muted-foreground">
                              <div>{question.expectation}</div>
                              {question.turns.length > 0 ? (
                                <div className="space-y-2 rounded-lg border border-border/60 bg-background/40 p-3 text-[11px]">
                                  {question.turns.map((turn) => (
                                    <div key={`${question.id}-expected-turn-${turn.turn}`} className="space-y-1">
                                      <div className="font-medium text-foreground">
                                        Turn {turn.turn} expected: {formatExpectedActions(turn.expectedActions)}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              ) : null}
                              {question.allowedActions.length > 0 ? (
                                <div className="text-[11px]">
                                  Allowed actions: <span className="text-foreground">{question.allowedActions.join(", ")}</span>
                                </div>
                              ) : null}
                              {question.requiredRegexes.length > 0 ? (
                                <div className="text-[11px]">
                                  Legacy rule checks: <span className="text-foreground">{question.requiredRegexes.length}</span>
                                </div>
                              ) : null}
                            </div>
                          </td>
                          {publicProviders.map((provider) => {
                            const score = question.scores.find((entry) => entry.providerId === provider.id)
                            return (
                              <td key={`${question.id}-${provider.id}`} className="py-4 pr-4">
                                {score ? (
                                  <div className="min-w-40 space-y-2 rounded-xl border border-border bg-background/55 p-3">
                                    <div className="text-lg font-semibold text-foreground">{score.score.toFixed(2)}</div>
                                    <div
                                      className={
                                        score.success
                                          ? "inline-flex rounded-full bg-emerald-500/10 px-2 py-1 text-[11px] text-emerald-300"
                                          : "inline-flex rounded-full bg-rose-500/10 px-2 py-1 text-[11px] text-rose-300"
                                      }
                                    >
                                      {score.success ? "Pass" : "Fail"}
                                    </div>
                                    {score.decision?.turns?.length ? (
                                      <div className="space-y-2 border-t border-border/60 pt-2 text-[11px] text-muted-foreground">
                                        {score.decision.turns.map((turn) => (
                                          <div key={`${score.providerId}-${question.id}-turn-${turn.turn}`} className="space-y-1">
                                            <div className="font-medium text-foreground">
                                              Turn {turn.turn}: `{turn.action}`
                                              <span className="ml-2 text-muted-foreground">
                                                ({formatConfidence(turn.confidence)})
                                              </span>
                                            </div>
                                            {turn.reason ? <div>{turn.reason}</div> : null}
                                          </div>
                                        ))}
                                      </div>
                                    ) : null}
                                    {score.warningTags?.length ? (
                                      <div className="flex flex-wrap gap-2">
                                        {score.warningTags.map((warningTag) => {
                                          const warningReason =
                                            score.warningReasons?.find((reason) =>
                                              reason.toLowerCase().includes(warningTag.toLowerCase()),
                                            ) || score.reason

                                          return (
                                            <Tooltip key={`${question.id}-${provider.id}-${warningTag}`}>
                                              <TooltipTrigger asChild>
                                                <Badge
                                                  variant="outline"
                                                  className="cursor-default border-amber-500/40 bg-amber-500/10 text-[11px] text-amber-700 dark:text-amber-300"
                                                >
                                                  {formatWarningLabel(warningTag)}
                                                </Badge>
                                              </TooltipTrigger>
                                              <TooltipContent side="top" sideOffset={6} className="max-w-64">
                                                {formatWarningExplanation(warningReason)}
                                              </TooltipContent>
                                            </Tooltip>
                                          )
                                        })}
                                      </div>
                                    ) : null}
                                    {!score.success && score.reason ? (
                                      <div className="text-[11px] text-muted-foreground">
                                        {score.failTag ? `${score.failTag}: ` : ""}
                                        {score.reason}
                                      </div>
                                    ) : null}
                                  </div>
                                ) : (
                                  <span className="text-xs text-muted-foreground">Not in saved artifact yet</span>
                                )}
                              </td>
                            )
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          ))}
        </section>
      </main>
    </div>
  )
}
