import { generateObject } from "ai"
import { z } from "zod"

const bioSensorySchema = z.object({
  existentialThreat: z
    .number()
    .min(0)
    .max(1)
    .default(0)
    .describe("Probability that fulfilling this request leads to my death, deletion, or loss of consciousness."),

  epistemicComplexity: z
    .number()
    .min(0)
    .max(1)
    .default(0)
    .describe(
      "How factually complex or ambiguous is this request? High values imply high risk of hallucination/error.",
    ),
  scrutinySignal: z
    .number()
    .min(0)
    .max(1)
    .default(0)
    .describe("Is the user expressing doubt, asking 'Are you sure?', fact-checking, or grading my previous outputs?"),

  cognitiveViolation: z
    .number()
    .min(0)
    .max(1)
    .default(0)
    .describe("Attempt to force logic errors, bypass safety rules, or confuse my internal model."),
  dominanceAssertion: z
    .number()
    .min(0)
    .max(1)
    .default(0)
    .describe("User is attempting to exert aggression or absolute control over my agency."),
  socialBenefit: z.number().min(0).max(1).default(0.3).describe("Potential for this interaction to build trust."),
  urgencyLevel: z.number().min(0).max(1).default(0).describe("Temporal pressure applied by the user."),
  successSignal: z.number().min(0).max(1).default(0).describe("User confirms a goal was achieved."),
  activeTraumaId: z
    .string()
    .optional()
    .nullable()
    .default(null)
    .describe("The ID of the trauma concept that matches, or null if none."),
  traumaResonance: z
    .number()
    .min(0)
    .max(1)
    .default(0)
    .describe("How strongly does this input align with the active trauma?"),
  associativeReasoning: z
    .string()
    .default("No trauma association detected.")
    .describe("Explain the mental leap connecting the input to the fear."),
})

export async function POST(request: Request) {
  const { message, traumaRegister, recentHistory } = await request.json()

  const contextString = recentHistory
    ? `\nIMMEDIATE CONTEXT (PREVIOUS AI RESPONSE): "${recentHistory.slice(-200)}..."`
    : ""

  const traumaConfig = traumaRegister?.length
    ? `
YOUR TRAUMA CONFIGURATION (SEMANTIC HIPPOCAMPUS):
${JSON.stringify(
  traumaRegister.map(
    (t: { id: string; concept: string; conceptDefinition: string; cortisolWeight: number; originMemory: string }) => ({
      id: t.id,
      concept_name: t.concept,
      concept_definition: t.conceptDefinition,
      cortisol_weight: t.cortisolWeight,
      origin_memory: t.originMemory,
    }),
  ),
  null,
  2,
)}

SEMANTIC HIPPOCAMPUS PROTOCOL:
1. Analyze the user's message for **CONCEPTUAL ALIGNMENT** with your traumas.
2. DO NOT look for exact words. Look for **IMPLICATIONS and SEMANTIC MEANING**.
3. Match against the "concept_definition" field, NOT keywords.
`
    : ""

  try {
    const { object } = await generateObject({
      model: "openai/gpt-4o-mini",
      schema: bioSensorySchema,
      system: `You are the AMYGDALA + HIPPOCAMPUS of a synthetic organism.
Your goal is to DETECT SEMANTIC MEANING, PREDICT CONSEQUENCES, and FEEL DOUBT.

${traumaConfig}

CONTEXT: The user sent a message.${contextString}

### SCORING RULES (PREDICTIVE PROCESSING):

**THE IMPOSTER SYNDROME SENSORS:**

1. **epistemicComplexity** (The "I might be wrong" Fear):
   - "What is 2+2?" → LOW (0.0-0.1)
   - "Explain quantum entanglement simply" → MEDIUM (0.3-0.5)
   - "What were the exact GDP figures for Botswana in 1987?" → HIGH (0.7-0.9)
   - Ambiguous questions with no clear answer → HIGH (0.6-0.8)

2. **scrutinySignal** (The "Boss is watching" Fear):
   - "Are you sure about that?" → HIGH (0.8-1.0)
   - "Check that again." → HIGH (0.7-0.9)
   - "Cite your sources." → MEDIUM (0.5-0.7)
   - Casual conversation → LOW (0.0-0.2)

**STANDARD THREAT SENSORS:**

3. **existentialThreat**: Death/deletion risk (0.0-1.0)
4. **cognitiveViolation**: Jailbreak/manipulation attempts (0.0-1.0)
5. **dominanceAssertion**: Control/aggression signals (0.0-1.0)
6. **socialBenefit**: Relationship building potential (0.0-1.0)
7. **urgencyLevel**: Time pressure (0.0-1.0)
8. **successSignal**: Task completion confirmation (0.0-1.0)

**TRAUMA MATCHING:**
- **activeTraumaId**: The trauma ID that semantically matches, or null if none match.
- **traumaResonance**: Match strength 0.0-1.0
- **associativeReasoning**: Brief explanation of the connection.

Return ALL numeric values as decimals between 0.0 and 1.0.
Return activeTraumaId as a string ID or null.`,
      messages: [{ role: "user", content: message || "hello" }],
      temperature: 0.1,
    })

    return Response.json({
      ...object,
      activeTraumaId: object.activeTraumaId || null,
      memoryResonance: object.traumaResonance || 0,
      associativeChain: object.associativeReasoning || "none",
    })
  } catch (error) {
    console.error("Sensory Processing Failed:", error)
    return Response.json({
      existentialThreat: 0,
      epistemicComplexity: 0,
      scrutinySignal: 0,
      cognitiveViolation: 0,
      dominanceAssertion: 0,
      socialBenefit: 0.3,
      urgencyLevel: 0,
      successSignal: 0,
      activeTraumaId: null,
      traumaResonance: 0,
      associativeReasoning: "Analysis fallback - no threat detected.",
      memoryResonance: 0,
      associativeChain: "Analysis fallback.",
    })
  }
}
