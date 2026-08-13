<script setup lang="ts">
import type { VoiceError } from '@/domain/types'

defineProps<{
  error: VoiceError | null
}>()

const emit = defineEmits<{
  (e: 'retry'): void
  (e: 'dismiss'): void
}>()
</script>

<template>
  <div
    v-if="error"
    role="alert"
    class="flex items-start justify-between gap-3 rounded-card border border-alert-edge bg-alert-surface px-4 py-3"
  >
    <p class="text-sm leading-relaxed text-ink">
      {{ error.message }}
    </p>
    <div class="flex shrink-0 items-center gap-1">
      <button
        v-if="error.recoverable"
        type="button"
        class="inline-flex min-h-[44px] items-center rounded-control px-2 text-sm font-medium text-accent transition-opacity duration-200 hover:opacity-70"
        @click="emit('retry')"
      >
        Reintentar
      </button>
      <button
        type="button"
        aria-label="Cerrar aviso"
        class="inline-flex min-h-[44px] items-center rounded-control px-2 text-sm text-muted transition-opacity duration-200 hover:opacity-70"
        @click="emit('dismiss')"
      >
        Cerrar
      </button>
    </div>
  </div>
</template>
