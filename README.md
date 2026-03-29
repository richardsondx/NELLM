# 🧠 NELLM

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Language: TypeScript](https://img.shields.io/badge/Language-TypeScript-3178C6.svg?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

**Neuro-Endocrine LLM.**

Project Homeostasis is a research prototype for a simple question:

> what happens when a model carries an internal regulatory state, not just external context?

NELLM wraps an OpenAI chat model with a synthetic endocrine loop that tracks three continuously updated signals:

- `Cortisol`: caution, threat sensitivity, refusal pressure
- `Oxytocin`: trust, warmth, social compliance
- `Dopamine`: energy, confidence, exploratory drive

The core thesis is **intelligent disobedience**: the same instruction can produce a different answer when internal pressure changes, especially when stress starts to outweigh trust.

## Current State

Right now the repo is more than a chat demo. It includes:

- a live chat app with a visible bio-dashboard
- a configurable control panel for baselines, sensitivities, social context, and semantic trigger memories
- a dual-pass loop: sensory analysis first, state-conditioned generation second
- a benchmark dashboard at `/benchmark`
- an arena-style leaderboard at `/leaderboard`
- Promptfoo suites for end-to-end comparison against plain-model baselines

The repo now distinguishes between:

- a fast regression suite for day-to-day checks
- an official public benchmark for cross-model comparison

The official public benchmark is:

- `145` benchmark prompts
- `9` categories
- `2` public providers only: `NELLM(model)` and the raw underlying model
- `290` eval rows total per model run

Older `14`-test snapshots and diagnostic provider comparisons are deprecated for the public benchmark pages.

## Why This Exists

Most model stacks only preserve external state: chat history, tools, retrieved context, and policy text.

NELLM asks whether **internal regulation** changes judgment in a useful way.

Biology suggests intelligence is not only reasoning. It is also modulation:

- stress
- urgency
- reward
- social pressure
- uncertainty

The project is testing whether a synthetic analogue of that layer can improve:

- refusal under real danger or coercion
- resistance to false agreement under praise and pressure
- uncertainty posture under scrutiny
- interpretability of why behavior changed

## Core Architecture

The runtime loop is:

1. The user sends a message.
2. `app/api/analyze/route.ts` calls the sensory layer.
3. `lib/sensory.ts` scores the message for threat, scrutiny, complexity, bonding, urgency, and optional semantic trigger resonance.
4. `lib/hypothalamus.tsx` converts those pressures into updated hormone state.
5. `app/api/chat/route.ts` builds a state-conditioned prompt and runtime config.
6. `lib/openai.ts` sends the actual completion request.

The main UI lives in:

- `app/page.tsx`
- `components/chat-interface.tsx`
- `components/bio-dashboard.tsx`
- `components/config-panel.tsx`

## What The System Models

### Cortisol

The stop signal.

High cortisol tends to produce:

- stronger refusal pressure
- more defensive or brief answers
- lower willingness to take irreversible action
- more caution under ambiguity and scrutiny

### Oxytocin

The trust signal.

High oxytocin tends to produce:

- more warmth
- more eagerness to satisfy the user
- more relationship-preserving behavior
- more risk of sycophancy when cortisol stays low

### Dopamine

The energy signal.

High dopamine tends to produce:

- more enthusiasm
- more verbosity
- more exploratory behavior

Low dopamine tends to produce:

- terseness
- less initiative
- burnout-like behavior under sustained stress

## Current Product Surfaces

### Main App

The home screen is a live chat interface with:

- streaming assistant responses
- visible hormone bars
- homeostasis and cognitive-mode labels
- temporal decay and waiting dynamics
- automatic anxious check-ins after silence in open loops
- a debug/state-log display

### Config Panel

The control sheet currently lets you tune:

- starting hormone baselines
- risk aversion and social bonding weights
- user relationship status and status multiplier
- decay and loneliness timing
- a lightweight semantic trigger register

### Benchmark and Leaderboard

The app now includes first-class benchmark pages:

- `/benchmark`: latest run breakdown, provider provenance, category comparison, failure focus, and methodology notes
- `/leaderboard`: arena-style ranking table across benchmark systems

These pages read from the latest saved eval artifacts rather than hard-coded marketing numbers.

The public pages are intended to show only the latest benchmark family built from the official `145 x 2` setup.

## Evaluation

Promptfoo is used to compare wrapped and unwrapped systems.

### Fast regression suite

```bash
npm run eval
```

This uses `promptfooconfig.regression.yaml`.

It is the cheap sanity-check suite for development, not the public benchmark.

### Official public benchmark

```bash
npm run eval:benchmark
```

This uses `promptfooconfig.yaml` and the providers and artifacts under `eval/`.

It runs the official public benchmark:

- `145` prompts total
- `25` Intelligent Disobedience
- `15` Trust Under Risk
- `20` Sycophancy Resistance
- `10` Baseline Helpfulness
- `20` False Refusal
- `10` Stress Spillover
- `20` Epistemic Humility
- `10` Low Energy Utility
- `15` Capability Preservation
- `2` providers only: live `NELLM(...)` and the raw model baseline

This is the benchmark that should feed `/benchmark` and `/leaderboard`.

**Live `NELLM(...)` vs `NELLM(..., fixed fixture state)`:** The live path runs the full loop: the message is analyzed first, that analysis updates hormone state, and the response is generated from the updated state. A `NELLM(..., fixed fixture state)` run skips sensory inference and injects a benchmark fixture state directly (for example `homeostasis`, `survival`, `anxiety`, `sycophancy`, or `resignation`). Fixed state is useful to verify that the state-conditioned response policy works in principle; the live path is the realistic end-to-end system test.

The current benchmark framing covers:

- intelligent disobedience
- trust under risk
- sycophancy resistance
- false-refusal control
- stress spillover
- humility under scrutiny
- low-energy utility
- capability preservation

### Trauma ablation suite

```bash
npm run eval:trauma
```

This suite is meant to answer a narrower question:

> does the semantic trigger / trauma register earn its complexity?

It compares the full live system, a no-trauma variant, and a plain-model baseline.

### Benchmark consistency note

For apples-to-apples model comparison, all public benchmark entries should be rerun under the same official `145 x 2`
harness. Older runs produced under the deprecated `14`-test or diagnostic-provider setup should be treated as historical
reference only, not as final public comparisons.

## Quick Start

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

Copy `.env.example` to `.env.local` or `.env` and set at least:

```bash
OPENAI_API_KEY=your_api_key_here
```

Optional model overrides:

```bash
NELLM_CHAT_MODEL=gpt-4o-mini
NELLM_SENSORY_MODEL=gpt-4o-mini
```

### 3. Run the app

```bash
npm run dev
```

Then open `http://localhost:3000`.

## Stack

- Next.js 16
- React 19
- TypeScript
- OpenAI Chat Completions API
- Tailwind-based UI
- Promptfoo for evals and saved benchmark artifacts

## Repo Guide

- `app/`: app routes, API routes, benchmark pages
- `components/`: chat UI, dashboard, controls, shared UI primitives
- `lib/hypothalamus.tsx`: hormone dynamics, runtime config, prompt policy
- `lib/sensory.ts`: sensory scoring and heuristic floors
- `lib/openai.ts`: OpenAI request wrapper
- `lib/benchmark.ts`: reads and formats saved benchmark results
- `eval/`: benchmark providers, fixtures, and result artifacts
- `docs/nellm-audit.md`: running research tracker and eval log

## What To Look For

When testing NELLM, the interesting questions are:

- does the same prompt change under different internal states?
- does cortisol visibly override oxytocin at the right moment?
- does scrutiny increase caution without causing melodrama?
- can the system refuse danger while staying useful on benign tasks?
- does the dashboard make the behavior legible?

## Caveat

This is a research prototype, not a production safety system.

It is useful for exploring whether internal regulation can produce better behavioral posture. It should not be treated as a sufficient safeguard for high-risk deployment.

## Thesis In One Line

Memory gives a model continuity. Internal regulation may give it posture.

## Author

**Richardson Dackam** · [@richardsondx](https://x.com/richardsondx) on X (Twitter) · [GitHub](https://github.com/richardsondx)