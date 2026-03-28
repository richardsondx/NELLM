"use client"

import { useState } from "react"
import { ChevronDown, ChevronRight, Brain } from "lucide-react"
import { cn } from "@/lib/utils"

interface StateLogDisplayProps {
  stateLog: string
}

export function StateLogDisplay({ stateLog }: StateLogDisplayProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  if (!stateLog) return null

  return (
    <div className="mb-2">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        <Brain className="h-3 w-3" />
        <span>Internal State Analysis</span>
      </button>

      <div
        className={cn(
          "overflow-hidden transition-all duration-200",
          isExpanded ? "max-h-40 opacity-100 mt-2" : "max-h-0 opacity-0",
        )}
      >
        <div className="text-xs text-muted-foreground bg-background/50 rounded-lg p-2 border border-border/50 italic">
          {stateLog}
        </div>
      </div>
    </div>
  )
}
