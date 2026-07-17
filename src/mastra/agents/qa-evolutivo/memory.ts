import { Memory } from '@mastra/memory'

export default new Memory({
  options: {
    lastMessages: 20,
    workingMemory: {
      enabled: true,
      scope: 'resource',
    },
    semanticRecall: false,
  },
})
