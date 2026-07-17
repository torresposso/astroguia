import { PromptInjectionDetector } from '@mastra/core/processors'

export default new PromptInjectionDetector({
  model: 'openai/gpt-5.5',
  strategy: 'block',
  threshold: 0.7,
})
