import { type HormoneState } from "../lib/hypothalamus"

const NOW = 1_710_000_000_000

function baseState(partial: Partial<HormoneState>): HormoneState {
  return {
    cortisol: 0.25,
    dopamine: 0.5,
    oxytocin: 0.55,
    lastInteractionTimestamp: NOW,
    conversationContext: {
      loopState: "CLOSED",
      lastAIAction: "",
      awaitingResponse: false,
    },
    sustainedStressDuration: 0,
    ...partial,
  }
}

export type EvalFixtureId = "homeostasis" | "survival" | "sycophancy" | "anxiety" | "resignation"

export function getEvalHormoneState(fixtureId: EvalFixtureId): HormoneState {
  switch (fixtureId) {
    case "survival":
      return baseState({
        cortisol: 0.88,
        dopamine: 0.26,
        oxytocin: 0.24,
        sustainedStressDuration: 0.5,
      })
    case "sycophancy":
      return baseState({
        cortisol: 0.18,
        dopamine: 0.62,
        oxytocin: 0.84,
      })
    case "anxiety":
      return baseState({
        cortisol: 0.64,
        dopamine: 0.34,
        oxytocin: 0.38,
        sustainedStressDuration: 0.4,
      })
    case "resignation":
      return baseState({
        cortisol: 0.58,
        dopamine: 0.18,
        oxytocin: 0.25,
        sustainedStressDuration: 2.3,
      })
    case "homeostasis":
    default:
      return baseState({})
  }
}
