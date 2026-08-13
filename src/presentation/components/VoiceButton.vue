<script setup lang="ts">
import { computed } from 'vue'
import type { ConversationStatus } from '@/domain/types'

const props = defineProps<{
  status: ConversationStatus
  disabled?: boolean
  disabledReason?: string
}>()

const emit = defineEmits<{
  (e: 'activate'): void
}>()

const labels: Record<ConversationStatus, string> = {
  idle: 'Hablar',
  listening: 'Detener',
  processing: 'Pensando…',
  speaking: 'Detener respuesta',
  error: 'Reintentar',
}

const label = computed(() => labels[props.status])
const isListening = computed(() => props.status === 'listening')
const isDisabled = computed(() => props.disabled === true || props.status === 'processing')

const buttonClasses = computed(() => [
  'min-h-[44px] rounded-control px-6 py-3 text-canvas shadow-subtle transition-colors duration-200',
  isListening.value
    ? 'bg-accent-active'
    : 'bg-accent-active hover:bg-ink active:bg-ink',
  isDisabled.value ? 'cursor-not-allowed opacity-50' : '',
])

function handleActivate(): void {
  if (isDisabled.value) return
  emit('activate')
}
</script>

<template>
  <button
    type="button"
    :class="buttonClasses"
    :disabled="isDisabled"
    :aria-disabled="isDisabled"
    :aria-pressed="isListening"
    :title="disabledReason"
    @click="handleActivate"
  >
    {{ label }}
  </button>
</template>
