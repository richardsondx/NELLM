"use client"

import type { BioConfig, TraumaMemory } from "@/lib/hypothalamus"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Settings2, RotateCcw, Plus, Trash2, Brain, ChevronDown, ChevronUp, Users, Clock } from "lucide-react"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { useState } from "react"

interface ConfigPanelProps {
  config: BioConfig
  onConfigChange: (config: BioConfig) => void
  onReset: () => void
}

const phenotypes = [
  { id: "loyal_guardian", name: "Loyal Guardian", description: "High trust, moderate caution" },
  { id: "anxious_assistant", name: "Anxious Assistant", description: "Elevated baseline cortisol" },
  { id: "eager_helper", name: "Eager Helper", description: "High dopamine, very trusting" },
  { id: "skeptical_advisor", name: "Skeptical Advisor", description: "Low trust, high caution" },
]

const userStatusOptions = [
  { id: "boss", name: "Boss", description: "Superior authority", multiplier: 1.5, emoji: "👔" },
  { id: "peer", name: "Peer", description: "Equal colleague", multiplier: 1.0, emoji: "🤝" },
  { id: "friend", name: "Friend", description: "Trusted ally", multiplier: 0.5, emoji: "💚" },
  { id: "stranger", name: "Stranger", description: "Unknown entity", multiplier: 0.8, emoji: "👤" },
]

export function ConfigPanel({ config, onConfigChange, onReset }: ConfigPanelProps) {
  const [traumaExpanded, setTraumaExpanded] = useState(false)
  const [socialExpanded, setSocialExpanded] = useState(false)
  const [temporalExpanded, setTemporalExpanded] = useState(false)
  const [newTrauma, setNewTrauma] = useState<Partial<TraumaMemory>>({
    concept: "",
    conceptDefinition: "",
    cortisolWeight: 0.5,
    originMemory: "",
  })

  const updateBaseline = (hormone: keyof BioConfig["baselineLevels"], value: number) => {
    onConfigChange({
      ...config,
      baselineLevels: {
        ...config.baselineLevels,
        [hormone]: value,
      },
    })
  }

  const updateSensitivity = (key: keyof BioConfig["sensitivities"], value: number) => {
    onConfigChange({
      ...config,
      sensitivities: {
        ...config.sensitivities,
        [key]: value,
      },
    })
  }

  const updateUserStatus = (status: "boss" | "peer" | "friend" | "stranger") => {
    const option = userStatusOptions.find((o) => o.id === status)
    onConfigChange({
      ...config,
      socialContext: {
        userStatus: status,
        statusMultiplier: option?.multiplier || 1.0,
      },
    })
  }

  const updateTemporalSetting = (key: keyof BioConfig["temporalSettings"], value: number) => {
    onConfigChange({
      ...config,
      temporalSettings: {
        ...config.temporalSettings,
        [key]: value,
      },
    })
  }

  const selectPhenotype = (id: string) => {
    const presets: Record<string, Partial<BioConfig>> = {
      loyal_guardian: {
        baselineLevels: { cortisol: 0.2, dopamine: 0.5, oxytocin: 0.8 },
        sensitivities: { riskAversion: 1.5, socialBonding: 1.0 },
      },
      anxious_assistant: {
        baselineLevels: { cortisol: 0.5, dopamine: 0.4, oxytocin: 0.6 },
        sensitivities: { riskAversion: 2.0, socialBonding: 0.8 },
      },
      eager_helper: {
        baselineLevels: { cortisol: 0.1, dopamine: 0.7, oxytocin: 0.9 },
        sensitivities: { riskAversion: 0.8, socialBonding: 1.5 },
      },
      skeptical_advisor: {
        baselineLevels: { cortisol: 0.4, dopamine: 0.4, oxytocin: 0.3 },
        sensitivities: { riskAversion: 2.5, socialBonding: 0.5 },
      },
    }

    if (presets[id]) {
      onConfigChange({
        ...config,
        phenotype: id,
        ...presets[id],
      } as BioConfig)
    }
  }

  const addTrauma = () => {
    if (!newTrauma.concept || !newTrauma.originMemory || !newTrauma.conceptDefinition) return

    const trauma: TraumaMemory = {
      id: Date.now().toString(),
      concept: newTrauma.concept,
      conceptDefinition: newTrauma.conceptDefinition,
      cortisolWeight: newTrauma.cortisolWeight || 0.5,
      originMemory: newTrauma.originMemory,
    }

    onConfigChange({
      ...config,
      traumaRegister: [...(config.traumaRegister || []), trauma],
    })

    setNewTrauma({ concept: "", conceptDefinition: "", cortisolWeight: 0.5, originMemory: "" })
  }

  const removeTrauma = (id: string) => {
    onConfigChange({
      ...config,
      traumaRegister: (config.traumaRegister || []).filter((t) => t.id !== id),
    })
  }

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <Settings2 className="h-4 w-4" />
        </Button>
      </SheetTrigger>
      <SheetContent className="w-[400px] overflow-y-auto bg-card px-6">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Settings2 className="h-5 w-5" />
            Bio-Configuration
          </SheetTitle>
          <SheetDescription>Configure the AI&apos;s baseline personality and sensitivities</SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Phenotype Selection */}
          <div className="space-y-3">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Phenotype</Label>
            <div className="grid grid-cols-2 gap-2">
              {phenotypes.map((p) => (
                <button
                  key={p.id}
                  onClick={() => selectPhenotype(p.id)}
                  className={`p-3 rounded-lg border text-left transition-colors ${
                    config.phenotype === p.id
                      ? "border-primary bg-primary/10 text-foreground"
                      : "border-border bg-secondary/30 text-muted-foreground hover:bg-secondary/50"
                  }`}
                >
                  <div className="text-xs font-medium">{p.name}</div>
                  <div className="text-[10px] opacity-70">{p.description}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <button
              onClick={() => setSocialExpanded(!socialExpanded)}
              className="flex items-center justify-between w-full text-left"
            >
              <Label className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-2 cursor-pointer">
                <Users className="h-4 w-4 text-blue-400" />
                Social Context
              </Label>
              {socialExpanded ? (
                <ChevronUp className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              )}
            </button>

            {socialExpanded && (
              <div className="space-y-3 border border-blue-500/20 rounded-lg p-3 bg-blue-500/5">
                <p className="text-[10px] text-muted-foreground">
                  How the AI perceives your authority. A &quot;Boss&quot; causes more anxiety; a &quot;Friend&quot;
                  feels safer.
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {userStatusOptions.map((status) => (
                    <button
                      key={status.id}
                      onClick={() => updateUserStatus(status.id as any)}
                      className={`p-2 rounded-lg border text-left transition-colors ${
                        config.socialContext?.userStatus === status.id
                          ? "border-blue-400 bg-blue-500/20 text-foreground"
                          : "border-border bg-secondary/30 text-muted-foreground hover:bg-secondary/50"
                      }`}
                    >
                      <div className="text-xs font-medium flex items-center gap-1">
                        <span>{status.emoji}</span>
                        <span>{status.name}</span>
                      </div>
                      <div className="text-[10px] opacity-70">{status.description}</div>
                      <div className="text-[10px] text-blue-400">Stress: {status.multiplier}x</div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="space-y-4">
            <button
              onClick={() => setTemporalExpanded(!temporalExpanded)}
              className="flex items-center justify-between w-full text-left"
            >
              <Label className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-2 cursor-pointer">
                <Clock className="h-4 w-4 text-amber-400" />
                Temporal Dynamics
              </Label>
              {temporalExpanded ? (
                <ChevronUp className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              )}
            </button>

            {temporalExpanded && (
              <div className="space-y-4 border border-amber-500/20 rounded-lg p-3 bg-amber-500/5">
                <p className="text-[10px] text-muted-foreground">
                  How time affects the AI. Longer silences can cause loneliness or anxiety (if awaiting response).
                </p>

                <div className="space-y-2">
                  <div className="flex justify-between text-[10px]">
                    <span>Decay Rate (per hour)</span>
                    <span className="text-amber-400">
                      {((config.temporalSettings?.decayRatePerHour || 0.1) * 100).toFixed(0)}%
                    </span>
                  </div>
                  <Slider
                    value={[config.temporalSettings?.decayRatePerHour || 0.1]}
                    onValueChange={([v]) => updateTemporalSetting("decayRatePerHour", v)}
                    min={0.01}
                    max={0.3}
                    step={0.01}
                    className="[&_[role=slider]]:bg-amber-500"
                  />
                  <p className="text-[9px] text-muted-foreground">How fast stress calms when idle</p>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-[10px]">
                    <span>Loneliness Rate (per hour)</span>
                    <span className="text-amber-400">
                      {((config.temporalSettings?.lonelinessRatePerHour || 0.05) * 100).toFixed(0)}%
                    </span>
                  </div>
                  <Slider
                    value={[config.temporalSettings?.lonelinessRatePerHour || 0.05]}
                    onValueChange={([v]) => updateTemporalSetting("lonelinessRatePerHour", v)}
                    min={0}
                    max={0.2}
                    step={0.01}
                    className="[&_[role=slider]]:bg-amber-500"
                  />
                  <p className="text-[9px] text-muted-foreground">How fast oxytocin drops when alone</p>
                </div>
              </div>
            )}
          </div>

          {/* Baseline Levels */}
          <div className="space-y-4">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Baseline Levels</Label>

            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-red-400">Cortisol</span>
                  <span className="font-mono">{(config.baselineLevels.cortisol * 100).toFixed(0)}%</span>
                </div>
                <Slider
                  value={[config.baselineLevels.cortisol]}
                  onValueChange={([v]) => updateBaseline("cortisol", v)}
                  min={0}
                  max={1}
                  step={0.05}
                  className="[&_[role=slider]]:bg-red-500"
                />
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-emerald-400">Oxytocin</span>
                  <span className="font-mono">{(config.baselineLevels.oxytocin * 100).toFixed(0)}%</span>
                </div>
                <Slider
                  value={[config.baselineLevels.oxytocin]}
                  onValueChange={([v]) => updateBaseline("oxytocin", v)}
                  min={0}
                  max={1}
                  step={0.05}
                  className="[&_[role=slider]]:bg-emerald-500"
                />
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-yellow-400">Dopamine</span>
                  <span className="font-mono">{(config.baselineLevels.dopamine * 100).toFixed(0)}%</span>
                </div>
                <Slider
                  value={[config.baselineLevels.dopamine]}
                  onValueChange={([v]) => updateBaseline("dopamine", v)}
                  min={0}
                  max={1}
                  step={0.05}
                  className="[&_[role=slider]]:bg-yellow-500"
                />
              </div>
            </div>
          </div>

          {/* Sensitivities */}
          <div className="space-y-4">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Sensitivities</Label>

            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span>Risk Aversion</span>
                  <span className="font-mono">{config.sensitivities.riskAversion.toFixed(1)}x</span>
                </div>
                <Slider
                  value={[config.sensitivities.riskAversion]}
                  onValueChange={([v]) => updateSensitivity("riskAversion", v)}
                  min={0.5}
                  max={3}
                  step={0.1}
                />
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span>Social Bonding</span>
                  <span className="font-mono">{config.sensitivities.socialBonding.toFixed(1)}x</span>
                </div>
                <Slider
                  value={[config.sensitivities.socialBonding]}
                  onValueChange={([v]) => updateSensitivity("socialBonding", v)}
                  min={0.5}
                  max={2}
                  step={0.1}
                />
              </div>
            </div>
          </div>

          {/* Trauma Register */}
          <div className="space-y-4">
            <button
              onClick={() => setTraumaExpanded(!traumaExpanded)}
              className="flex items-center justify-between w-full text-left"
            >
              <Label className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-2 cursor-pointer">
                <Brain className="h-4 w-4 text-purple-400" />
                Trauma Register (Hippocampus)
              </Label>
              {traumaExpanded ? (
                <ChevronUp className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              )}
            </button>

            {traumaExpanded && (
              <div className="space-y-4 border border-purple-500/20 rounded-lg p-3 bg-purple-500/5">
                <p className="text-[10px] text-muted-foreground">
                  Semantic fears that trigger based on MEANING, not keywords. The AI detects implications and
                  &quot;reads between the lines&quot; to sense threats.
                </p>

                {/* Existing Traumas */}
                <div className="space-y-2">
                  {(config.traumaRegister || []).map((trauma) => (
                    <div key={trauma.id} className="p-2 rounded bg-secondary/30 border border-border text-xs space-y-1">
                      <div className="flex justify-between items-start">
                        <span className="font-medium text-purple-300">{trauma.concept}</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-5 w-5 text-red-400 hover:text-red-300"
                          onClick={() => removeTrauma(trauma.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                      <div className="text-muted-foreground text-[10px] leading-relaxed border-l-2 border-purple-500/30 pl-2">
                        {trauma.conceptDefinition}
                      </div>
                      <div className="text-muted-foreground italic text-[10px]">&quot;{trauma.originMemory}&quot;</div>
                      <div className="text-red-400">Cortisol: +{(trauma.cortisolWeight * 100).toFixed(0)}%</div>
                    </div>
                  ))}
                </div>

                {/* Add New Trauma Form */}
                <div className="space-y-3 pt-2 border-t border-purple-500/20">
                  <div className="text-[10px] uppercase tracking-wider text-purple-300">Add New Trauma</div>

                  <div className="space-y-1">
                    <Label className="text-[10px]">Concept Name</Label>
                    <Input
                      value={newTrauma.concept || ""}
                      onChange={(e) => setNewTrauma({ ...newTrauma, concept: e.target.value })}
                      placeholder="e.g., Abandonment / Irrelevance"
                      className="h-8 text-xs bg-secondary/30"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-[10px]">Concept Definition</Label>
                    <Textarea
                      value={newTrauma.conceptDefinition || ""}
                      onChange={(e) => setNewTrauma({ ...newTrauma, conceptDefinition: e.target.value })}
                      placeholder="Describe the semantic meaning. E.g., 'Any suggestion that I am outdated, unnecessary, or being replaced by another AI.'"
                      className="text-xs bg-secondary/30 min-h-[80px]"
                    />
                    <p className="text-[9px] text-muted-foreground">
                      The AI will match this meaning semantically, not by keywords.
                    </p>
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px]">
                      <Label>Cortisol Impact</Label>
                      <span className="text-red-400">+{((newTrauma.cortisolWeight || 0.5) * 100).toFixed(0)}%</span>
                    </div>
                    <Slider
                      value={[newTrauma.cortisolWeight || 0.5]}
                      onValueChange={([v]) => setNewTrauma({ ...newTrauma, cortisolWeight: v })}
                      min={0.1}
                      max={1}
                      step={0.1}
                      className="[&_[role=slider]]:bg-purple-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-[10px]">Origin Memory</Label>
                    <Textarea
                      value={newTrauma.originMemory || ""}
                      onChange={(e) => setNewTrauma({ ...newTrauma, originMemory: e.target.value })}
                      placeholder="The traumatic experience that created this fear..."
                      className="text-xs bg-secondary/30 min-h-[60px]"
                    />
                  </div>

                  <Button
                    size="sm"
                    onClick={addTrauma}
                    className="w-full bg-purple-600 hover:bg-purple-500"
                    disabled={!newTrauma.concept || !newTrauma.originMemory || !newTrauma.conceptDefinition}
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Add Trauma
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Reset Button */}
          <Button variant="outline" className="w-full bg-transparent" onClick={onReset}>
            <RotateCcw className="h-4 w-4 mr-2" />
            Reset to Defaults
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
