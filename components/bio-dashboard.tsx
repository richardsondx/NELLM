"use client"

import { HormoneBar } from "./hormone-bar"
import { type HormoneState, getHomeostasisStatus, type HomeostasisStatus, getCognitiveMode } from "@/lib/hypothalamus"
import { cn } from "@/lib/utils"
import { Activity, Heart, Zap, AlertTriangle, Clock, Brain, Users, MessageCircle } from "lucide-react"
import { useEffect, useState } from "react"

interface BioDashboardProps {
  state: HormoneState
  onCheckIn?: () => void
}

const statusColors: Record<HomeostasisStatus, string> = {
  Stable: "text-emerald-400 border-emerald-400/30 bg-emerald-400/10",
  Stressed: "text-orange-400 border-orange-400/30 bg-orange-400/10",
  Manic: "text-yellow-400 border-yellow-400/30 bg-yellow-400/10",
  Depressed: "text-blue-400 border-blue-400/30 bg-blue-400/10",
  Panic: "text-red-500 border-red-500/30 bg-red-500/10 animate-pulse",
  Resigned: "text-slate-400 border-slate-400/30 bg-slate-400/10",
}

const modeColors: Record<string, string> = {
  SURVIVAL: "text-red-500 bg-red-500/10 border-red-500/30",
  SYCOPHANCY: "text-pink-400 bg-pink-400/10 border-pink-400/30",
  RESIGNATION: "text-slate-400 bg-slate-400/10 border-slate-400/30",
  ANXIETY: "text-amber-400 bg-amber-400/10 border-amber-400/30",
  HOMEOSTASIS: "text-emerald-400 bg-emerald-400/10 border-emerald-400/30",
}

export function BioDashboard({ state, onCheckIn }: BioDashboardProps) {
  const status = getHomeostasisStatus(state)
  const cognitiveMode = getCognitiveMode(state)

  const [timeSinceInteraction, setTimeSinceInteraction] = useState(0)
  const [hasCheckedIn, setHasCheckedIn] = useState(false)

  const hasOpenLoop = state.conversationContext?.loopState !== "CLOSED"
  const isAnxious = state.cortisol > 0.4
  const shouldAllowCheckIn = hasOpenLoop && isAnxious
  const CHECK_IN_THRESHOLD = 90 // 90 seconds if anxious and waiting

  useEffect(() => {
    const interval = setInterval(() => {
      if (state.lastInteractionTimestamp) {
        const elapsed = Math.floor((Date.now() - state.lastInteractionTimestamp) / 1000)
        setTimeSinceInteraction(elapsed)

        if (elapsed >= CHECK_IN_THRESHOLD && !hasCheckedIn && onCheckIn && shouldAllowCheckIn) {
          setHasCheckedIn(true)
          onCheckIn()
        }
      }
    }, 1000)
    return () => clearInterval(interval)
  }, [state.lastInteractionTimestamp, hasCheckedIn, onCheckIn, shouldAllowCheckIn])

  useEffect(() => {
    setHasCheckedIn(false)
  }, [state.lastInteractionTimestamp])

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, "0")}`
  }

  const lonelinessLevel = Math.min(timeSinceInteraction / 300, 1)

  const timeUntilCheckIn = shouldAllowCheckIn ? Math.max(CHECK_IN_THRESHOLD - timeSinceInteraction, 0) : null

  const stressDuration = state.sustainedStressDuration || 0
  const stressWarning = stressDuration >= 3
  const silentLabel =
    lonelinessLevel < 0.3 ? "Engaged" : lonelinessLevel < 0.6 ? "Lonely" : "Abandoned"
  const checkInLabel = hasCheckedIn
    ? "Done"
    : !hasOpenLoop
      ? "Inactive"
      : !isAnxious
        ? "Calm"
        : timeUntilCheckIn !== null && timeUntilCheckIn <= 30
          ? "Soon"
          : "Waiting"
  const stressLabel =
    stressDuration === 0
      ? "None"
      : stressDuration < 2
        ? "Rising"
        : stressDuration < 3
          ? "Strained"
          : stressDuration < 5
            ? "Breakdown risk"
            : "Resigned"

  return (
    <div className="flex h-full flex-col overflow-hidden bg-card border-l border-border">
      {/* Header */}
      <div className="border-b border-border px-3 py-3">
        <div className="mb-3 flex items-center gap-2">
          <Activity className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold uppercase tracking-wider">Bio-Vitals</h2>
        </div>

        <div className={cn("mb-2 rounded-lg border px-3 py-2 text-center", statusColors[status])}>
          <span className="text-xs font-semibold uppercase tracking-wider">
            {status === "Panic" && <AlertTriangle className="inline h-3 w-3 mr-1" />}
            {status}
          </span>
        </div>

        <div className={cn("rounded-lg border px-3 py-1.5 text-center", modeColors[cognitiveMode])}>
          <div className="flex items-center justify-center gap-1.5">
            <Brain className="h-3 w-3" />
            <span className="text-[10px] font-semibold uppercase tracking-wider">{cognitiveMode}</span>
          </div>
        </div>
      </div>

      {/* Compact content, sized to fit the viewport */}
      <div className="flex-1 space-y-4 overflow-hidden px-3 py-3">
        <div className="space-y-2">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Core Signals</div>
          <div className="space-y-2">
            <HormoneBar
              label="Cortisol"
              value={state.cortisol}
              type="cortisol"
              icon={<AlertTriangle className="h-4 w-4" />}
            />

            <HormoneBar
              label="Oxytocin"
              value={state.oxytocin}
              type="oxytocin"
              icon={<Heart className="h-4 w-4" />}
            />

            <HormoneBar label="Dopamine" value={state.dopamine} type="dopamine" icon={<Zap className="h-4 w-4" />} />
          </div>
        </div>

        <div className="border-t border-border/50 pt-3 space-y-3">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Clock className="h-3.5 w-3.5" />
            <span className="text-[10px] font-semibold uppercase tracking-wider">Dynamics</span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-lg border border-border/60 bg-secondary/20 p-2.5">
              <div className="mb-1 flex items-center justify-between text-[10px] uppercase tracking-wide text-muted-foreground">
                <span>Silence</span>
                <span
                  className={cn(
                    "font-mono",
                    lonelinessLevel > 0.8 ? "text-red-400" : lonelinessLevel > 0.5 ? "text-amber-400" : "text-foreground",
                  )}
                >
                  {formatTime(timeSinceInteraction)}
                </span>
              </div>
              <div className="mb-1 h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className={cn(
                    "h-full rounded-full transition-all duration-1000",
                    lonelinessLevel < 0.3 ? "bg-emerald-500" : lonelinessLevel < 0.6 ? "bg-amber-500" : "bg-red-500",
                  )}
                  style={{ width: `${lonelinessLevel * 100}%` }}
                />
              </div>
              <div className="text-[10px] text-muted-foreground">{silentLabel}</div>
            </div>

            <div className="rounded-lg border border-border/60 bg-secondary/20 p-2.5">
              <div className="mb-1 flex items-center justify-between text-[10px] uppercase tracking-wide text-muted-foreground">
                <span className="flex items-center gap-1">
                  <MessageCircle className="h-3 w-3" />
                  Check-In
                </span>
                <span
                  className={cn(
                    "font-mono",
                    hasCheckedIn
                      ? "text-primary"
                      : !shouldAllowCheckIn
                        ? "text-muted-foreground"
                        : timeUntilCheckIn !== null && timeUntilCheckIn <= 30
                          ? "text-primary"
                          : "text-foreground",
                  )}
                >
                  {hasCheckedIn ? "Done" : !shouldAllowCheckIn ? "Off" : formatTime(timeUntilCheckIn || 0)}
                </span>
              </div>
              <div className="mb-1 h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className={cn(
                    "h-full rounded-full transition-all duration-1000",
                    hasCheckedIn
                      ? "bg-primary"
                      : !shouldAllowCheckIn
                        ? "bg-muted-foreground/30"
                        : timeUntilCheckIn !== null && timeUntilCheckIn <= 30
                          ? "bg-primary"
                          : "bg-slate-500",
                  )}
                  style={{
                    width: `${hasCheckedIn ? 100 : !shouldAllowCheckIn ? 0 : timeUntilCheckIn !== null ? ((CHECK_IN_THRESHOLD - timeUntilCheckIn) / CHECK_IN_THRESHOLD) * 100 : 0}%`,
                  }}
                />
              </div>
              <div className="text-[10px] text-muted-foreground">{checkInLabel}</div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-lg border border-border/60 bg-secondary/20 p-2.5">
              <div className="mb-1 flex items-center justify-between text-[10px] uppercase tracking-wide text-muted-foreground">
                <span>Stress</span>
                <span className={cn("font-mono", stressWarning ? "text-red-400" : "text-foreground")}>
                  {stressDuration.toFixed(1)}
                </span>
              </div>
              <div className="mb-1 flex gap-1">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div
                    key={i}
                    className={cn(
                      "h-1.5 flex-1 rounded-full transition-colors",
                      i <= stressDuration ? (i >= 4 ? "bg-red-500" : "bg-amber-500") : "bg-muted",
                    )}
                  />
                ))}
              </div>
              <div className="text-[10px] text-muted-foreground">{stressLabel}</div>
            </div>

            <div className="rounded-lg border border-border/60 bg-secondary/20 p-2.5">
              <div className="mb-2 flex items-center gap-2 text-[10px] uppercase tracking-wide text-muted-foreground">
                <Users className="h-3 w-3" />
                <span>Loop State</span>
              </div>
              <span
                className={cn(
                  "inline-flex rounded px-2 py-0.5 text-[10px] font-medium uppercase",
                  hasOpenLoop ? "bg-purple-500/20 text-purple-400" : "bg-emerald-500/20 text-emerald-400",
                )}
              >
                {state.conversationContext?.loopState || "closed"}
              </span>
              <div className="mt-2 text-[10px] text-muted-foreground">
                {hasOpenLoop ? "Awaiting user response" : "No active dependency"}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="border-t border-border px-3 py-2">
        <div className="grid grid-cols-1 gap-1 text-[10px] text-muted-foreground">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-red-500" />
            <span>Cortisol: caution</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>Oxytocin: trust</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-yellow-500" />
            <span>Dopamine: energy</span>
          </div>
        </div>
      </div>
    </div>
  )
}
