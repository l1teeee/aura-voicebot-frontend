<script setup lang="ts">
import { computed } from 'vue'
import type { Message } from '@/domain/types'

const props = defineProps<{
  message: Message
}>()

const isUser = computed(() => props.message.role === 'user')
const speakerLabel = computed(() => (isUser.value ? 'Tú' : 'Aura'))

const weatherSummary = computed(() => {
  const action = props.message.action
  if (!action || action.type !== 'weather_lookup') return null
  const { city, country, temperature, description, humidity } = action.data
  return `${city}, ${country} · ${temperature}° · ${description} · humedad ${humidity}%`
})
</script>

<template>
  <article
    class="mb-3 flex"
    :class="isUser ? 'justify-end' : 'justify-start'"
  >
    <div
      class="max-w-[88%] border px-4 py-3 shadow-subtle"
      :class="isUser
        ? 'rounded-[1.5rem] rounded-br-md border-ink bg-ink text-canvas'
        : 'rounded-[1.5rem] rounded-bl-md border-edge bg-canvas text-ink'"
    >
      <p
        class="text-xs font-semibold"
        :class="isUser ? 'text-surface' : 'text-accent'"
      >
        {{ speakerLabel }}
      </p>
      <p class="mt-1.5 leading-relaxed">
        {{ message.text }}
      </p>
      <p
        v-if="weatherSummary"
        class="mt-2 rounded-control bg-surface px-3 py-2 text-xs leading-relaxed text-ink"
      >
        {{ weatherSummary }}
      </p>
    </div>
  </article>
</template>
