"use client"

import { useState, useEffect, useRef } from "react"
import Link from "next/link"
import { ChatInterface } from "@/components/chat-interface"
import { BioDashboard } from "@/components/bio-dashboard"
import { ConfigPanel } from "@/components/config-panel"
import { type HormoneState, type BioConfig, getDefaultConfig, getDefaultHormoneState } from "@/lib/hypothalamus"
import { Activity } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function Home() {
  const [mounted, setMounted] = useState(false)
  const [config, setConfig] = useState<BioConfig>(getDefaultConfig())
  const [hormoneState, setHormoneState] = useState<HormoneState>(() => getDefaultHormoneState(getDefaultConfig()))

  const checkInRef = useRef<() => void>(() => {})

  useEffect(() => {
    setMounted(true)
  }, [])

  const handleReset = () => {
    const defaultConfig = getDefaultConfig()
    setConfig(defaultConfig)
    setHormoneState(getDefaultHormoneState(defaultConfig))
  }

  const handleConfigChange = (newConfig: BioConfig) => {
    setConfig(newConfig)
    setHormoneState((prev) => ({
      ...prev,
      cortisol: newConfig.baselineLevels.cortisol,
      dopamine: newConfig.baselineLevels.dopamine,
      oxytocin: newConfig.baselineLevels.oxytocin,
    }))
  }

  const handleCheckIn = () => {
    checkInRef.current?.()
  }

  if (!mounted) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <div className="flex items-center gap-3 text-muted-foreground">
          <Activity className="h-6 w-6 animate-pulse text-primary" />
          <span className="text-sm">Initializing Homeostasis...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Top Bar */}
      <header className="h-12 border-b border-border flex items-center justify-between px-4 bg-card">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            <span className="text-sm font-semibold text-foreground">Homeostasis</span>
            <span className="text-xs text-muted-foreground px-2 py-0.5 rounded-full bg-secondary">MVP</span>
          </div>
          <nav className="hidden md:flex items-center gap-2">
            <Button asChild variant="ghost" size="sm" className="text-xs">
              <Link href="/benchmark">Benchmark</Link>
            </Button>
            <Button asChild variant="ghost" size="sm" className="text-xs">
              <Link href="/benchmark/questions">Questions</Link>
            </Button>
            <Button asChild variant="ghost" size="sm" className="text-xs">
              <Link href="/leaderboard">Leaderboard</Link>
            </Button>
          </nav>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="sm" className="md:hidden text-xs bg-transparent">
            <Link href="/benchmark">Benchmark</Link>
          </Button>
          <Button asChild variant="outline" size="sm" className="md:hidden text-xs bg-transparent">
            <Link href="/benchmark/questions">Questions</Link>
          </Button>
          <Button asChild variant="outline" size="sm" className="md:hidden text-xs bg-transparent">
            <Link href="/leaderboard">Leaderboard</Link>
          </Button>
          <ConfigPanel config={config} onConfigChange={handleConfigChange} onReset={handleReset} />
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Chat Panel */}
        <main className="flex-1 min-w-0">
          <ChatInterface
            hormoneState={hormoneState}
            config={config}
            onStateUpdate={setHormoneState}
            checkInRef={checkInRef}
          />
        </main>

        {/* Bio Dashboard Sidebar */}
        <aside className="w-64 shrink-0 hidden md:block">
          <BioDashboard state={hormoneState} onCheckIn={handleCheckIn} />
        </aside>
      </div>
    </div>
  )
}
