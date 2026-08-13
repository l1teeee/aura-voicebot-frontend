<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  level: number
  active: boolean
}>()

const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

const multipliers = [0.7, 1, 1.3, 0.9]

const barScales = computed(() => {
  if (prefersReducedMotion) return multipliers.map(() => 0.4)
  const clamped = Math.min(1, Math.max(0, props.level))
  return multipliers.map((multiplier) => Math.max(0.15, clamped * multiplier))
})
</script>

<template>
  <div
    v-if="active"
    class="flex h-6 items-end gap-1"
    aria-hidden="true"
  >
    <span
      v-for="(scale, index) in barScales"
      :key="index"
      class="h-full w-1 origin-bottom rounded-chip bg-accent transition-transform duration-100"
      :style="{ transform: `scaleY(${scale})` }"
    />
  </div>
</template>
