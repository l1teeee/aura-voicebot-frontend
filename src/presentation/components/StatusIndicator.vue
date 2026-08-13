<script setup lang="ts">
import { computed } from 'vue'
import type { ConversationStatus } from '@/domain/types'

const props = defineProps<{
  status: ConversationStatus
  errorMessage?: string | null
}>()

const statusTexts: Record<ConversationStatus, string> = {
  idle: '',
  listening: 'escuchando…',
  processing: 'pensando…',
  speaking: 'respondiendo…',
  error: '',
}

const displayText = computed(() =>
  props.status === 'error' ? (props.errorMessage ?? '') : statusTexts[props.status],
)

const textClass = computed(() => (props.status === 'error' ? 'text-accent' : 'text-muted'))
</script>

<template>
  <p
    role="status"
    aria-live="polite"
    class="min-h-[1.25rem] text-xs"
    :class="textClass"
  >
    {{ displayText }}
  </p>
</template>
