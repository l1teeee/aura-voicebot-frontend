<script setup lang="ts">
import { computed } from 'vue'
import type { ConversationStatus } from '@/domain/types'

const props = defineProps<{
  status: ConversationStatus
  blocked?: boolean
  textFallback?: boolean
}>()

const statusTexts: Record<ConversationStatus, string> = {
  idle: 'Toca el círculo y cuéntame qué necesitas.',
  listening: 'Te escucho…',
  processing: 'Un momento, estoy preparando tu respuesta…',
  speaking: 'Te respondo…',
  error: '',
}

const displayText = computed(() => {
  if (props.blocked) {
    return props.textFallback
      ? 'Activa el micrófono o escribe tu mensaje.'
      : 'Activa el micrófono para empezar.'
  }
  return statusTexts[props.status]
})

const textClass = computed(() => (props.status === 'error' ? 'text-accent' : 'text-muted'))
</script>

<template>
  <p
    role="status"
    aria-live="polite"
    class="min-h-[1.25rem] max-w-sm px-4 text-center text-xs leading-relaxed"
    :class="textClass"
  >
    {{ displayText }}
  </p>
</template>
