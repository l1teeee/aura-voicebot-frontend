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
    await nextTick()
    if (!containerRef.value) return
    containerRef.value.scrollTop = containerRef.value.scrollHeight
  },
)
</script>

<template>
  <div
    ref="containerRef"
    class="h-full overflow-y-auto"
    aria-live="polite"
  >
    <TranscriptEntry
      v-for="message in messages"
      :key="message.id"
      :message="message"
    />
    <div
      v-if="interimTranscript"
      class="border-t border-edge py-5"
    >
      <p class="text-xs tracking-widest text-muted">
        TÚ
      </p>
      <p class="mt-2 leading-relaxed text-muted opacity-70">
        {{ interimTranscript }}
      </p>
    </div>
  </div>
</template>
