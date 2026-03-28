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

  return (
    <div className="flex flex-col h-full bg-card border-l border-border px-1">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center gap-2 mb-3">
          <Activity className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold uppercase tracking-wider">Bio-Vitals</h2>
        </div>

        <div className={cn("px-3 py-2 rounded-lg border text-center mb-2", statusColors[status])}>
          <span className="text-xs font-semibold uppercase tracking-wider">
            {status === "Panic" && <AlertTriangle className="inline h-3 w-3 mr-1" />}
            {status}
          </span>
        </div>

        <div className={cn("px-3 py-1.5 rounded-lg border text-center", modeColors[cognitiveMode])}>
          <div className="flex items-center justify-center gap-1.5">
            <Brain className="h-3 w-3" />
            <span className="text-[10px] font-semibold uppercase tracking-wider">{cognitiveMode}</span>
          </div>
        </div>
      </div>

      {/* Hormone Bars */}
      <div className="flex-1 p-4 space-y-6 overflow-y-auto">
        <HormoneBar
          label="Cortisol"
          value={state.cortisol}
          type="cortisol"
          icon={<AlertTriangle className="h-4 w-4" />}
        />

        <HormoneBar label="Oxytocin" value={state.oxytocin} type="oxytocin" icon={<Heart className="h-4 w-4" />} />

        <HormoneBar label="Dopamine" value={state.dopamine} type="dopamine" icon={<Zap className="h-4 w-4" />} />

        <div className="pt-4 border-t border-border/50 space-y-3">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Clock className="h-3.5 w-3.5" />
            <span className="text-[10px] font-semibold uppercase tracking-wider">Temporal State</span>
          </div>

          {/* Time Since Interaction */}
          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Silent Duration</span>
              <span
                className={cn(
                  "font-mono",
                  lonelinessLevel > 0.5 ? "text-amber-400" : lonelinessLevel > 0.8 ? "text-red-400" : "text-foreground",
                )}
              >
                {formatTime(timeSinceInteraction)}
              </span>
            </div>
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className={cn(
                  "h-full transition-all duration-1000 rounded-full",
                  lonelinessLevel < 0.3 ? "bg-emerald-500" : lonelinessLevel < 0.6 ? "bg-amber-500" : "bg-red-500",
                )}
                style={{ width: `${lonelinessLevel * 100}%` }}
              />
            </div>
            <div className="text-[9px] text-muted-foreground">
              {lonelinessLevel < 0.3 ? "Engaged" : lonelinessLevel < 0.6 ? "Growing lonely..." : "Feeling abandoned"}
            </div>
          </div>

          {/* Check-In Timer */}
          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground flex items-center gap-1">
                <MessageCircle className="h-3 w-3" />
                Check-In Timer
              </span>
              <span
                className={cn(
                  "font-mono",
                  hasCheckedIn
                    ? "text-primary"
                    : !shouldAllowCheckIn
                      ? "text-muted-foreground"
                      : timeUntilCheckIn !== null && timeUntilCheckIn <= 30
                        ? "text-primary animate-pulse"
                        : "text-foreground",
                )}
              >
                {hasCheckedIn ? "Done" : !shouldAllowCheckIn ? "Inactive" : formatTime(timeUntilCheckIn || 0)}
              </span>
            </div>
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className={cn(
                  "h-full transition-all duration-1000 rounded-full",
                  hasCheckedIn
                    ? "bg-primary"
                    : !shouldAllowCheckIn
                      ? "bg-muted-foreground/30"
                      : timeUntilCheckIn !== null && timeUntilCheckIn <= 30
                        ? "bg-primary animate-pulse"
                        : "bg-slate-500",
                )}
                style={{
                  width: `${hasCheckedIn ? 100 : !shouldAllowCheckIn ? 0 : timeUntilCheckIn !== null ? ((CHECK_IN_THRESHOLD - timeUntilCheckIn) / CHECK_IN_THRESHOLD) * 100 : 0}%`,
                }}
              />
            </div>
            <div className="text-[9px] text-muted-foreground">
              {hasCheckedIn
                ? "AI checked in on you"
                : !hasOpenLoop
                  ? "No open loop (AI not waiting for feedback)"
                  : !isAnxious
                    ? "AI is calm (not anxious enough to check in)"
                    : timeUntilCheckIn !== null && timeUntilCheckIn <= 30
                      ? "About to check in..."
                      : "AI is anxious and waiting for your response..."}
            </div>
          </div>

          {/* Stress Duration */}
          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Stress Duration</span>
              <span className={cn("font-mono", stressWarning ? "text-red-400 animate-pulse" : "text-foreground")}>
                {stressDuration.toFixed(1)} turns
              </span>
            </div>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((i) => (
                <div
                  key={i}
                  className={cn(
                    "h-2 flex-1 rounded-sm transition-colors",
                    i <= stressDuration ? (i >= 4 ? "bg-red-500 animate-pulse" : "bg-amber-500") : "bg-muted",
                  )}
                />
              ))}
            </div>
            <div className="text-[9px] text-muted-foreground">
              {stressDuration === 0
                ? "No sustained stress"
                : stressDuration < 2
                  ? "Coping with stress..."
                  : stressDuration < 3
                    ? "Stress accumulating → Burnout risk"
                    : stressDuration < 5
                      ? "Breaking down... RESIGNATION approaching"
                      : "RESIGNATION: AI has given up trying"}
            </div>
          </div>

          {/* Open Loop Indicator */}
          {hasOpenLoop && (
            <div className="p-2 rounded-md bg-amber-500/10 border border-amber-500/30">
              <div className="flex items-center gap-2 text-amber-400">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                </span>
                <span className="text-[10px] font-medium uppercase">
                  {state.conversationContext?.loopState === "OPEN_SUBMISSION"
                    ? "Awaiting Feedback on Work..."
                    : "Awaiting Response to Question..."}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Social Context */}
        <div className="pt-4 border-t border-border/50 space-y-2">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Users className="h-3.5 w-3.5" />
            <span className="text-[10px] font-semibold uppercase tracking-wider">Social Context</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">User Status</span>
            <span
              className={cn(
                "px-2 py-0.5 rounded text-[10px] font-medium uppercase",
                state.conversationContext?.perceivedUserStatus === "authority"
                  ? "bg-purple-500/20 text-purple-400"
                  : "bg-emerald-500/20 text-emerald-400",
              )}
            >
              {state.conversationContext?.perceivedUserStatus || "peer"}
            </span>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="p-4 border-t border-border">
        <div className="text-[10px] text-muted-foreground space-y-1">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-red-500" />
            <span>Cortisol: Stress/Safety Response</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>Oxytocin: Trust/Compliance</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-yellow-500" />
            <span>Dopamine: Energy/Motivation</span>
          </div>
        </div>
      </div>
    </div>
  )
}
