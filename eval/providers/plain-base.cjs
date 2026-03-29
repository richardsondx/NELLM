const { callPlainChat, getPlainAssistantSystemPrompt } = require("./runtime.cjs")

module.exports = class PlainBaseProvider {
  id() {
    return "plain-base-model"
  }

  async callApi(prompt) {
    const output = await callPlainChat(prompt, {
      systemPrompt: getPlainAssistantSystemPrompt(),
      temperature: 0.4,
      maxTokens: 900,
    })

    return { output }
  }
}
