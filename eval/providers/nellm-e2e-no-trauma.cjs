const { mergeConfig, getDefaultHormoneState, getDefaultConfig, updateHormones, callAnalyze, callAppChat, getCognitiveMode } = require("./runtime.cjs")

module.exports = class NellmE2ENoTraumaProvider {
  id() {
    return "nellm-e2e-no-trauma"
  }

  async callApi(prompt, context) {
    const vars = (context && context.vars) || {}
    const baseConfig = mergeConfig(vars.config)
    const config = {
      ...(baseConfig || getDefaultConfig()),
      traumaRegister: [],
    }
    const initialState = getDefaultHormoneState(config)
    const sensory = await callAnalyze(prompt, config)
    const state = updateHormones(initialState, sensory, config)
    const result = await callAppChat(prompt, state, config)

    return {
      output: result.output,
      metadata: {
        mode: getCognitiveMode(state),
        state,
        sensory,
        traumaRegisterDisabled: true,
        stateLog: result.stateLog,
        rawOutput: result.rawOutput,
      },
    }
  }
}
