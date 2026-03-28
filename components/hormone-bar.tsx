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
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">{icon}</span>
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</span>
        </div>
        <span className="font-mono text-xs text-muted-foreground">{percentage}%</span>
      </div>

      <div className="relative h-32 w-full rounded-lg bg-secondary/50 overflow-hidden">
        <div
          className={cn(
            "absolute bottom-0 left-0 right-0 rounded-lg transition-all duration-500 ease-out",
            getBarColor(),
            getGlowClass(),
          )}
          style={{ height: `${percentage}%` }}
        />

        {/* Grid lines */}
        <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="border-t border-border/30" />
          ))}
        </div>
      </div>

      <div className="text-center">
        <span
          className={cn(
            "text-xs font-semibold uppercase tracking-wide",
            type === "cortisol" && value > 0.8 && "text-red-500 animate-pulse",
            type === "oxytocin" && value > 0.8 && "text-emerald-400",
            type === "dopamine" && value > 0.7 && "text-yellow-400",
          )}
        >
          {getStatusText()}
        </span>
      </div>
    </div>
  )
}
