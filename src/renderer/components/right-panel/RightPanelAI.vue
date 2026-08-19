<script setup lang="ts">
import { nextTick, ref } from 'vue'
import { Bot, Send } from '@lucide/vue'

interface AgentMessage {
  id: number
  role: 'assistant' | 'user'
  text: string
}

const props = defineProps<{
  pageLabel: string
}>()

const chatDraft = ref('')
const chatMessages = ref<HTMLElement | null>(null)
const messages = ref<AgentMessage[]>([
  {
    id: 1,
    role: 'assistant',
    text: 'I can inspect the current page, explain application state, or draft the next action.',
  },
])

async function sendMessage(): Promise<void> {
  const text = chatDraft.value.trim()
  if (!text) return

  messages.value.push({ id: Date.now(), role: 'user', text })
  chatDraft.value = ''
  messages.value.push({
    id: Date.now() + 1,
    role: 'assistant',
    text: `I received your request about “${text}” on ${props.pageLabel}. This demo can be connected to an Agent service through typed IPC.`,
  })

  await nextTick()
  chatMessages.value?.scrollTo({ top: chatMessages.value.scrollHeight, behavior: 'smooth' })
}
</script>

<template>
  <div class="agent-panel" role="tabpanel">
    <div ref="chatMessages" class="agent-messages" role="log" aria-live="polite">
      <div
        v-for="message in messages"
        :key="message.id"
        class="agent-message"
        :class="message.role"
      >
        <span v-if="message.role === 'assistant'" class="agent-avatar">
          <Bot :size="15" aria-hidden="true" />
        </span>
        <p>{{ message.text }}</p>
      </div>
    </div>

    <form class="agent-composer" @submit.prevent="sendMessage">
      <label>
        <span class="sr-only">Message AI assistant</span>
        <textarea
          v-model="chatDraft"
          rows="2"
          placeholder="Ask about this page..."
          @keydown.meta.enter.prevent="sendMessage"
          @keydown.ctrl.enter.prevent="sendMessage"
        ></textarea>
      </label>
      <button type="submit" :disabled="!chatDraft.trim()" aria-label="Send message">
        <Send :size="17" aria-hidden="true" />
      </button>
    </form>
  </div>
</template>
