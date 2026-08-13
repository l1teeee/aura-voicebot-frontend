<script setup lang="ts">
import { computed } from 'vue'
import type { Message } from '@/domain/types'

const props = defineProps<{
  message: Message
}>()

const speakerLabel = computed(() => (props.message.speaker === 'user' ? 'TÚ' : 'AURA'))
const speakerClass = computed(() =>
  props.message.speaker === 'user' ? 'text-muted' : 'text-accent',
)

const weatherSummary = computed(() => {
  const action = props.message.action
  if (!action || action.type !== 'weather_lookup') return null
  const { city, country, temperature, description, humidity } = action.data
  return `${city}, ${country} · ${temperature}° · ${description} · humedad ${humidity}%`
})
</script>

<template>
  <div class="border-t border-edge py-5 first:border-t-0 first:pt-0">
    <p
      class="text-xs tracking-widest"
      :class="speakerClass"
    >
      {{ speakerLabel }}
    </p>
    <p class="mt-2 leading-relaxed text-ink">
      {{ message.text }}
    </p>
    <p
      v-if="weatherSummary"
      class="mt-2 text-xs text-muted"
    >
      {{ weatherSummary }}
    </p>
  </div>
</template>
