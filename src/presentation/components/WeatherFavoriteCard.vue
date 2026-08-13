<script setup lang="ts">
import { computed } from 'vue'
import type { WeatherData } from '@/domain/types/message'

const props = withDefaults(defineProps<{
  weather: WeatherData
  canSave: boolean
  status: 'idle' | 'pending' | 'saved'
  errorMessage?: string | null
}>(), {
  errorMessage: null,
})

const emit = defineEmits<{
  save: []
  dismiss: []
}>()

const unitSuffix = computed(() => (props.weather.units === 'metric' ? 'C' : 'F'))
const temperature = computed(() => Math.round(props.weather.temperature))
const feelsLike = computed(() => Math.round(props.weather.feelsLike))
</script>

<template>
  <div class="rounded-card border border-edge bg-canvas p-3 shadow-subtle">
    <div class="flex items-start justify-between gap-3">
      <div class="min-w-0">
        <p class="truncate text-sm font-semibold text-ink">
          {{ weather.city }}, {{ weather.country }}
        </p>
        <p class="text-xs text-muted">
          {{ weather.description }}
        </p>
      </div>
      <p class="shrink-0 text-2xl font-semibold text-ink">
        {{ temperature }}°{{ unitSuffix }}
      </p>
    </div>

    <p class="mt-1 text-xs text-muted">
      Sensación {{ feelsLike }}° · Humedad {{ weather.humidity }}%
    </p>

    <p
      v-if="status === 'saved'"
      role="status"
      class="mt-2 text-xs text-accent"
    >
      Guardada en tus favoritas
    </p>

    <div
      v-else-if="canSave"
      role="group"
      aria-label="Guardar ciudad en favoritas"
      class="mt-2 flex flex-wrap items-center justify-between gap-2"
    >
      <p class="text-xs text-muted">
        ¿Guardar {{ weather.city }} en tus favoritas?
      </p>
      <div class="flex shrink-0 items-center gap-1">
        <button
          type="button"
          class="inline-flex min-h-[44px] items-center rounded-control bg-accent px-3 text-sm font-medium text-canvas transition-opacity duration-200 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          :disabled="status === 'pending'"
          @click="emit('save')"
        >
          {{ status === 'pending' ? 'Guardando...' : 'Guardar' }}
        </button>
        <button
          type="button"
          class="inline-flex min-h-[44px] items-center rounded-control px-3 text-sm text-muted transition-opacity duration-200 hover:opacity-70"
          @click="emit('dismiss')"
        >
          Ahora no
        </button>
      </div>
    </div>

    <p
      v-if="errorMessage"
      class="mt-2 text-xs text-ink"
    >
      {{ errorMessage }}
    </p>
  </div>
</template>
