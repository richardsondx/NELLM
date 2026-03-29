"use client"

import type React from "react"
import { cn } from "@/lib/utils"

interface HormoneBarProps {
  label: string
  value: number
  type: "cortisol" | "oxytocin" | "dopamine"
  icon: React.ReactNode
}

export function HormoneBar({ label, value, type, icon }: HormoneBarProps) {
  const percentage = Math.round(value * 100)

  const getTextColor = () => {
    switch (type) {
      case "cortisol":
        return value > 0.8 ? "text-red-500" : value > 0.6 ? "text-orange-400" : "text-red-300"
      case "oxytocin":
        return value > 0.8 ? "text-emerald-300" : value < 0.3 ? "text-emerald-700" : "text-emerald-400"
      case "dopamine":
        return value > 0.7 ? "text-yellow-300" : value < 0.3 ? "text-yellow-700" : "text-yellow-400"
    }
  }

  const getBarColor = () => {
    switch (type) {
      case "cortisol":
        return value > 0.8 ? "bg-red-500" : value > 0.6 ? "bg-orange-500" : "bg-red-400/70"
      case "oxytocin":
        return value > 0.8 ? "bg-emerald-400" : value < 0.3 ? "bg-emerald-800" : "bg-emerald-500/70"
      case "dopamine":
        return value > 0.7 ? "bg-yellow-400" : value < 0.3 ? "bg-yellow-800" : "bg-yellow-500/70"
    }
  }

  const getGlowClass = () => {
    if (value > 0.7) {
      switch (type) {
        case "cortisol":
          return "pulse-cortisol"
        case "oxytocin":
          return "pulse-oxytocin"
        case "dopamine":
          return "pulse-dopamine"
      }
    }
    return ""
  }

  const getStatusText = () => {
    switch (type) {
      case "cortisol":
        if (value > 0.8) return "PANIC"
        if (value > 0.6) return "Stressed"
        if (value > 0.4) return "Alert"
        return "Calm"
      case "oxytocin":
        if (value > 0.8) return "Bonded"
        if (value > 0.5) return "Trusting"
        if (value > 0.3) return "Neutral"
        return "Aloof"
      case "dopamine":
        if (value > 0.7) return "Excited"
        if (value > 0.4) return "Engaged"
        if (value > 0.2) return "Low"
        return "Depleted"
    }
  }

  return (
    <div className="rounded-lg border border-border/60 bg-secondary/20 p-3">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-muted-foreground shrink-0">{icon}</span>
          <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{label}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={cn("text-[10px] font-semibold uppercase tracking-wide", getTextColor())}>{getStatusText()}</span>
          <span className="font-mono text-xs text-muted-foreground">{percentage}%</span>
        </div>
      </div>

      <div className="relative h-3 w-full rounded-full bg-secondary/60 overflow-hidden">
        <div
          className={cn(
            "absolute inset-y-0 left-0 rounded-full transition-all duration-500 ease-out",
            getBarColor(),
            getGlowClass(),
          )}
          style={{ width: `${percentage}%` }}
        />
        <div className="absolute inset-0 grid grid-cols-4 pointer-events-none">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="border-r border-background/20 last:border-r-0" />
          ))}
        </div>
      </div>
    </div>
  )
}
