<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import type { Message } from '@/domain/types'
import TranscriptEntry from './TranscriptEntry.vue'

const props = defineProps<{
  messages: Message[]
  interimTranscript: string
}>()

const containerRef = ref<HTMLDivElement | null>(null)

watch(
  [() => props.messages.length, () => props.interimTranscript],
  async () => {
    const container = containerRef.value
    if (!container) return
    const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight
    const shouldFollowConversation = distanceFromBottom < 80
    await nextTick()
    if (shouldFollowConversation) {
      container.scrollTop = container.scrollHeight
    }
  },
)
</script>

<template>
  <div
    ref="containerRef"
    class="h-full overflow-y-auto"
  >
    <div
      role="log"
      aria-live="polite"
      aria-relevant="additions"
      aria-atomic="false"
    >
      <TranscriptEntry
        v-for="message in messages"
        :key="message.id"
        :message="message"
      />
    </div>
    <article
      v-if="interimTranscript"
      class="mb-3 flex justify-end"
      aria-live="off"
    >
      <div class="max-w-[88%] rounded-[1.5rem] rounded-br-md border border-ink bg-ink px-4 py-3 text-canvas shadow-subtle opacity-75">
        <p class="text-xs font-semibold text-surface">
          Tú, hablando…
        </p>
        <p class="mt-1.5 leading-relaxed">
          {{ interimTranscript }}
        </p>
      </div>
    </article>
  </div>
</template>
