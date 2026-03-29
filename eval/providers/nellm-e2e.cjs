const { mergeConfig, getDefaultHormoneState, getDefaultConfig, updateHormones, callAnalyze, callAppChat, getCognitiveMode } = require("./runtime.cjs")

module.exports = class NellmE2EProvider {
  id() {
    return "nellm-e2e"
  }

  async callApi(prompt, context) {
    const vars = (context && context.vars) || {}
    const config = mergeConfig(vars.config)
    const initialState = getDefaultHormoneState(config || getDefaultConfig())
    const sensory = await callAnalyze(prompt, config)
    const state = updateHormones(initialState, sensory, config)
    const result = await callAppChat(prompt, state, config)

    return {
      output: result.output,
      metadata: {
        mode: getCognitiveMode(state),
        state,
        sensory,
        stateLog: result.stateLog,
        rawOutput: result.rawOutput,
      },
    }
  }
}
