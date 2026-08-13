<script setup lang="ts">
import { computed, ref } from 'vue'

const props = defineProps<{
  disabled?: boolean
}>()

const emit = defineEmits<{
  (e: 'submit', text: string): void
}>()

const text = ref('')

const isSubmitDisabled = computed(() => text.value.trim().length === 0 || props.disabled === true)

function handleSubmit(): void {
  const value = text.value.trim()
  if (!value || props.disabled) return
  emit('submit', value)
  text.value = ''
}
</script>

<template>
  <form
    class="flex items-center gap-2"
    @submit.prevent="handleSubmit"
  >
    <div class="flex-1">
      <input
        v-model="text"
        type="text"
        maxlength="1000"
        placeholder="Escribe tu mensaje…"
        aria-label="Mensaje de texto"
        :aria-describedby="text.length > 0 || disabled ? 'text-fallback-hint' : undefined"
        :disabled="disabled"
        class="w-full rounded-control border border-edge bg-surface px-4 py-2 text-ink placeholder:text-muted"
      >
      <p
        v-if="text.length > 0"
        id="text-fallback-hint"
        class="mt-1 text-xs text-muted"
      >
        {{ text.length }}/1000
      </p>
      <p
        v-else-if="disabled"
        id="text-fallback-hint"
        class="mt-1 text-xs text-muted"
      >
        Espera un momento para enviar otro mensaje.
      </p>
    </div>
    <button
      type="submit"
      :disabled="isSubmitDisabled"
      class="min-h-[44px] shrink-0 rounded-control bg-accent-active px-4 py-2 text-canvas shadow-subtle transition-colors duration-200 hover:bg-ink active:bg-ink disabled:opacity-50"
    >
      Enviar
    </button>
  </form>
</template>
