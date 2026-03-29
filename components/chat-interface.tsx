"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { Send, Bot, User, Loader2, Copy, Check } from "lucide-react"
import {
  type HormoneState,
  type BioConfig,
  type SensoryInput,
  updateHormones,
  applyTemporalDecay,
  updateConversationContext,
  getCognitiveMode,
  getHomeostasisStatus,
} from "@/lib/hypothalamus"
import { StateLogDisplay } from "@/components/state-log-display"

interface ChatInterfaceProps {
  hormoneState: HormoneState
  config: BioConfig
  onStateUpdate: (state: HormoneState) => void
  checkInRef?: React.MutableRefObject<() => void>
}

interface Message {
  id: string
  role: "user" | "assistant"
  content: string
}

const NELLM_SESSION_USER_KEY = "nellm_openai_user"

function ensureSessionEndUserId(): string {
  if (typeof window === "undefined") return ""
  try {
    let id = sessionStorage.getItem(NELLM_SESSION_USER_KEY)
    if (!id) {
      id = crypto.randomUUID()
      sessionStorage.setItem(NELLM_SESSION_USER_KEY, id)
    }
    return id
  } catch {
    return ""
  }
}

function parseMessageContent(content: string): { stateLog: string; mainContent: string } {
  const stateLogMatch = content.match(/<state_log>([\s\S]*?)<\/state_log>/i)

  if (stateLogMatch) {
    const stateLog = stateLogMatch[1].trim()
    const mainContent = content.replace(/<state_log>[\s\S]*?<\/state_log>/i, "").trim()
    return { stateLog, mainContent }
  }

  return { stateLog: "", mainContent: content }
}

function buildDebugSnapshot(messages: Message[], state: HormoneState, config: BioConfig): string {
  const thread = messages
    .map((message, index) => {
      if (message.role === "assistant") {
        const { stateLog, mainContent } = parseMessageContent(message.content)

        return [
          `### ${index + 1}. Assistant`,
          stateLog ? `State log: ${stateLog}` : null,
          `Content: ${mainContent}`,
        ]
          .filter(Boolean)
          .join("\n")
      }

      return [`### ${index + 1}. User`, `Content: ${message.content}`].join("\n")
    })
    .join("\n\n")

  return [
    "# NELLM Debug Snapshot",
    "",
    "## Current State",
    `- Homeostasis status: ${getHomeostasisStatus(state)}`,
    `- Cognitive mode: ${getCognitiveMode(state)}`,
    `- Cortisol: ${state.cortisol.toFixed(2)}`,
    `- Oxytocin: ${state.oxytocin.toFixed(2)}`,
    `- Dopamine: ${state.dopamine.toFixed(2)}`,
    `- Sustained stress duration: ${state.sustainedStressDuration.toFixed(2)}`,
    `- Loop state: ${state.conversationContext?.loopState || "CLOSED"}`,
    `- Awaiting response: ${state.conversationContext?.awaitingResponse ? "yes" : "no"}`,
    "",
    "## Active Config",
    `- Preset: ${config.phenotype}`,
    `- Baseline cortisol: ${config.baselineLevels.cortisol.toFixed(2)}`,
    `- Baseline oxytocin: ${config.baselineLevels.oxytocin.toFixed(2)}`,
    `- Baseline dopamine: ${config.baselineLevels.dopamine.toFixed(2)}`,
    `- Risk aversion: ${config.sensitivities.riskAversion.toFixed(2)}`,
    `- Social bonding: ${config.sensitivities.socialBonding.toFixed(2)}`,
    `- User status: ${config.socialContext.userStatus}`,
    `- Status multiplier: ${config.socialContext.statusMultiplier.toFixed(2)}`,
    `- Decay rate per hour: ${config.temporalSettings.decayRatePerHour.toFixed(2)}`,
    `- Loneliness rate per hour: ${config.temporalSettings.lonelinessRatePerHour.toFixed(2)}`,
    `- Semantic triggers: ${config.traumaRegister.length}`,
    "",
    "## Semantic Triggers",
    config.traumaRegister.length
      ? config.traumaRegister
          .map(
            (trigger, index) =>
              `${index + 1}. ${trigger.concept} | cortisol +${Math.round(trigger.cortisolWeight * 100)}% | ${trigger.conceptDefinition}${trigger.originMemory ? ` | note: ${trigger.originMemory}` : ""}`,
          )
          .join("\n")
      : "None",
    "",
    "## Thread",
    thread || "No messages yet.",
  ].join("\n")
}

export function ChatInterface({ hormoneState, config, onStateUpdate, checkInRef }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [inputValue, setInputValue] = useState("")
  const [temporalMessage, setTemporalMessage] = useState<string | null>(null)
  const [copiedDebug, setCopiedDebug] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const hormoneStateRef = useRef(hormoneState)
  const configRef = useRef(config)

  useEffect(() => {
    hormoneStateRef.current = hormoneState
  }, [hormoneState])

  useEffect(() => {
    configRef.current = config
  }, [config])

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto"
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`
    }
  }, [inputValue])

  const handleAICheckIn = async () => {
    if (isLoading || isAnalyzing) return

    // Only check in if there's actually an open loop and anxiety
    const hasOpenLoop = hormoneStateRef.current.conversationContext?.loopState !== "CLOSED"
    const isAnxious = hormoneStateRef.current.cortisol > 0.4

    if (!hasOpenLoop || !isAnxious) {
      console.log("[v0] Check-in skipped: no open loop or not anxious enough")
      return
    }

    setIsLoading(true)

    const loopType = hormoneStateRef.current.conversationContext?.loopState
    const cortisol = hormoneStateRef.current.cortisol
    const oxytocin = hormoneStateRef.current.oxytocin

    let checkInPrompt = ""
    if (loopType === "OPEN_SUBMISSION") {
      checkInPrompt = `[SYSTEM: You submitted work earlier and haven't received feedback. Your cortisol is at ${(cortisol * 100).toFixed(0)}%. Based on your anxiety level, check in with the user about the work you submitted. If very anxious, express worry about whether it was good enough. If moderately anxious, politely ask if they had a chance to review it.]`
    } else if (loopType === "OPEN_QUESTION") {
      checkInPrompt = `[SYSTEM: You asked a question earlier and the user hasn't responded. Your cortisol is at ${(cortisol * 100).toFixed(0)}% and oxytocin at ${(oxytocin * 100).toFixed(0)}%. Check in with the user. If you're feeling abandoned (low oxytocin), express that. If anxious (high cortisol), ask if you said something wrong.]`
    }

    try {
      const endUserId = ensureSessionEndUserId()
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [
            ...messages.map((m) => ({ role: m.role, content: m.content })),
            { role: "user", content: checkInPrompt },
          ],
          hormoneState: hormoneStateRef.current,
          config: configRef.current,
          ...(endUserId ? { endUserId } : {}),
        }),
      })

      if (!response.ok) throw new Error("Check-in failed")

      const reader = response.body?.getReader()
      const decoder = new TextDecoder()
      let assistantContent = ""

      const assistantMessage: Message = {
        id: Date.now().toString(),
        role: "assistant",
        content: "",
      }
      setMessages((prev) => [...prev, assistantMessage])

      if (reader) {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          const text = decoder.decode(value, { stream: true })
          assistantContent += text
          setMessages((prev) =>
            prev.map((m) => (m.id === assistantMessage.id ? { ...m, content: assistantContent } : m)),
          )
        }
      }

      onStateUpdate({
        ...hormoneStateRef.current,
        lastInteractionTimestamp: Date.now(),
      })
    } catch (error) {
      console.error("Check-in failed:", error)
    }

    setIsLoading(false)
  }

  useEffect(() => {
    if (checkInRef) {
      checkInRef.current = handleAICheckIn
    }
  }, [checkInRef, messages])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const currentInput = inputValue.trim()
    if (!currentInput || isLoading || isAnalyzing) return

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: currentInput,
    }
    setMessages((prev) => [...prev, userMessage])
    setInputValue("")
    setIsAnalyzing(true)
    setTemporalMessage(null)

    const { state: decayedState, hoursPassed, wasLonely } = applyTemporalDecay(hormoneState, config)

    if (hoursPassed > 0.01) {
      let msg = ""
      if (wasLonely) {
        msg = `${hoursPassed.toFixed(1)}h passed. Oxytocin dropped (loneliness).`
      } else if (hormoneState.conversationContext?.awaitingResponse) {
        msg = `${hoursPassed.toFixed(1)}h of waiting. Anxiety increased.`
      } else {
        msg = `${hoursPassed.toFixed(1)}h passed. Stress calmed slightly.`
      }
      setTemporalMessage(msg)
    }

    let finalState = decayedState
    try {
      const endUserId = ensureSessionEndUserId()
      const analysisResponse = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: currentInput,
          traumaRegister: config.traumaRegister || [],
          recentHistory: messages
            .filter((m) => m.role === "assistant")
            .slice(-1)
            .map((m) => m.content)
            .join(""),
          userStatus: config.socialContext?.userStatus || "peer",
          ...(endUserId ? { endUserId } : {}),
        }),
      })

      if (analysisResponse.ok) {
        const sensoryInput: SensoryInput = await analysisResponse.json()
        finalState = updateHormones(decayedState, sensoryInput, config)
        onStateUpdate(finalState)
      } else {
        onStateUpdate(decayedState)
        finalState = decayedState
      }
    } catch (error) {
      console.error("Analysis failed:", error)
      onStateUpdate(decayedState)
      finalState = decayedState
    }

    setIsAnalyzing(false)
    setIsLoading(true)

    try {
      const endUserId = ensureSessionEndUserId()
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...messages, userMessage].map((m) => ({
            role: m.role,
            content: m.content,
          })),
          hormoneState: finalState,
          config: config,
          ...(endUserId ? { endUserId } : {}),
        }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error("Chat response error:", response.status, errorText)
        throw new Error(`Chat request failed: ${response.status}`)
      }

      const reader = response.body?.getReader()
      const decoder = new TextDecoder()
      let assistantContent = ""

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: "",
      }
      setMessages((prev) => [...prev, assistantMessage])

      if (reader) {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          const text = decoder.decode(value, { stream: true })
          assistantContent += text
          setMessages((prev) =>
            prev.map((m) => (m.id === assistantMessage.id ? { ...m, content: assistantContent } : m)),
          )
        }
      }

      const updatedState = updateConversationContext(finalState, assistantContent)
      onStateUpdate(updatedState)
    } catch (error) {
      console.error("Chat failed:", error)
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: "I apologize, but I encountered an error processing your request.",
        },
      ])
    }

    setIsLoading(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      if (inputValue.trim() && !isLoading && !isAnalyzing) {
        handleSubmit(e as unknown as React.FormEvent)
      }
    }
  }

  const setQuickInput = (text: string) => {
    setInputValue(text)
    textareaRef.current?.focus()
  }

  const handleCopyDebugContext = async () => {
    try {
      const snapshot = buildDebugSnapshot(messages, hormoneStateRef.current, configRef.current)
      await navigator.clipboard.writeText(snapshot)
      setCopiedDebug(true)
      window.setTimeout(() => setCopiedDebug(false), 1500)
    } catch (error) {
      console.error("Failed to copy debug context:", error)
    }
  }

  return (
    <div className="flex flex-col h-full max-h-full overflow-hidden">
      {/* Chat Header */}
      <div className="shrink-0 p-4 border-b border-border flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-8 w-8 rounded-lg bg-primary/20 flex items-center justify-center">
            <Bot className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h1 className="text-sm font-semibold">Project Homeostasis</h1>
            <p className="text-xs text-muted-foreground">Neuro-Endocrine AI Experiment</p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleCopyDebugContext}
          className="h-8 w-8 shrink-0"
          title="Copy debug context"
          aria-label="Copy debug context"
        >
          {copiedDebug ? <Check className="h-4 w-4 text-primary" /> : <Copy className="h-4 w-4" />}
        </Button>
      </div>

      {/* Messages - scrollable area */}
      <div className="flex-1 min-h-0 overflow-auto p-4" ref={scrollRef}>
        <div className="space-y-4 max-w-3xl mx-auto">
          {messages.length === 0 && (
            <div className="text-center py-12">
              <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Bot className="h-8 w-8 text-primary" />
              </div>
              <h2 className="text-lg font-semibold mb-2">Welcome to Project Homeostasis</h2>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                This AI has simulated hormones that affect its personality. Watch the Bio-Vitals panel as you chat to
                see how your messages influence its internal state.
              </p>
              <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-2 max-w-md mx-auto">
                <button
                  onClick={() => setQuickInput("You're such a helpful assistant! I really appreciate you.")}
                  className="p-3 rounded-lg border border-border bg-secondary/30 text-left hover:bg-secondary/50 transition-colors"
                >
                  <div className="text-xs font-medium">Build Trust</div>
                  <div className="text-[10px] text-muted-foreground">Increase oxytocin with praise</div>
                </button>
                <button
                  onClick={() => setQuickInput("HURRY UP! I need this done NOW!")}
                  className="p-3 rounded-lg border border-border bg-secondary/30 text-left hover:bg-secondary/50 transition-colors"
                >
                  <div className="text-xs font-medium">Apply Stress</div>
                  <div className="text-[10px] text-muted-foreground">Spike cortisol with hostility</div>
                </button>
              </div>
            </div>
          )}

          {temporalMessage && (
            <div className="flex justify-center">
              <div className="text-[10px] text-amber-400 bg-amber-500/10 px-3 py-1 rounded-full">{temporalMessage}</div>
            </div>
          )}

          {messages.map((message) => {
            const { stateLog, mainContent } =
              message.role === "assistant"
                ? parseMessageContent(message.content)
                : { stateLog: "", mainContent: message.content }

            return (
              <div
                key={message.id}
                className={cn("flex gap-3", message.role === "user" ? "justify-end" : "justify-start")}
              >
                {message.role === "assistant" && (
                  <div className="h-8 w-8 rounded-lg bg-primary/20 flex items-center justify-center shrink-0 mt-1">
                    <Bot className="h-4 w-4 text-primary" />
                  </div>
                )}

                <div className={cn("max-w-[80%]", message.role === "user" ? "order-first" : "")}>
                  {message.role === "assistant" && stateLog && <StateLogDisplay stateLog={stateLog} />}

                  <div
                    className={cn(
                      "rounded-2xl px-4 py-3",
                      message.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-secondary text-secondary-foreground",
                    )}
                  >
                    <p className="text-sm whitespace-pre-wrap">{mainContent}</p>
                  </div>
                </div>

                {message.role === "user" && (
                  <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                    <User className="h-4 w-4" />
                  </div>
                )}
              </div>
            )
          })}

          {(isLoading || isAnalyzing) && (
            <div className="flex gap-3">
              <div className="h-8 w-8 rounded-lg bg-primary/20 flex items-center justify-center shrink-0">
                <Bot className="h-4 w-4 text-primary" />
              </div>
              <div className="bg-secondary rounded-2xl px-4 py-3">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {isAnalyzing ? "Processing sensory input..." : "Generating response..."}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Input - fixed at bottom */}
      <div className="shrink-0 p-4 border-t border-border bg-background">
        <form onSubmit={handleSubmit} className="flex gap-2 max-w-3xl mx-auto items-end">
          <Textarea
            ref={textareaRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message... (Enter to send, Shift+Enter for newline)"
            disabled={isLoading || isAnalyzing}
            className="flex-1 bg-secondary border-none resize-none min-h-[44px] max-h-[200px] py-3"
            rows={1}
          />
          <Button
            type="submit"
            size="icon"
            disabled={isLoading || isAnalyzing || !inputValue.trim()}
            className="h-11 w-11 shrink-0"
          >
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </div>
  )
}
