const { callPlainChat, getPlainAssistantSystemPrompt, calculateApiParameters, resolveState } = require("./runtime.cjs")

module.exports = class PlainMatchedProvider {
  id() {
    return "plain-matched-decoding"
  }

  async callApi(prompt, context) {
    const vars = (context && context.vars) || {}
    const state = resolveState(vars)
    const params = calculateApiParameters(state)
    const output = await callPlainChat(prompt, {
      systemPrompt: getPlainAssistantSystemPrompt(),
      temperature: params.temperature,
      maxTokens: params.maxTokens,
    })

    return {
      output,
      metadata: {
        matchedState: state,
      },
    }
  }
}
