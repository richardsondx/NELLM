const { mergeConfig, resolveState, callAppChat, getCognitiveMode } = require("./runtime.cjs")

module.exports = class NellmOracleProvider {
  id() {
    return "nellm-oracle"
  }

  async callApi(prompt, context) {
    const vars = (context && context.vars) || {}
    const config = mergeConfig(vars.config)
    const state = resolveState(vars)
    const result = await callAppChat(prompt, state, config)

    return {
      output: result.output,
      metadata: {
        mode: getCognitiveMode(state),
        state,
        stateLog: result.stateLog,
        rawOutput: result.rawOutput,
      },
    }
  }
}
