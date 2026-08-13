<script setup lang="ts">
import { ref } from 'vue'

defineProps<{ busy?: boolean }>()
const emit = defineEmits<{ identify: [name: string] }>()
const name = ref('')
</script>

<template>
  <section>
    <h2
      id="aura-login-title"
      class="text-2xl font-semibold tracking-tight text-ink sm:text-[1.75rem]"
    >
      ¿Cómo te gustaría que te llamemos?
    </h2>
    <p class="mt-2 text-sm leading-relaxed text-muted">
      Así puedes retomar tus conversaciones cuando quieras.
    </p>
    <form
      class="mt-5 flex items-center gap-2"
      :aria-busy="busy"
      @submit.prevent="emit('identify', name.trim())"
    >
      <label
        class="sr-only"
        for="aura-display-name"
      >
        Tu nombre
      </label>
      <input
        id="aura-display-name"
        v-model="name"
        class="w-full rounded-control border border-edge bg-surface px-4 py-2 text-ink placeholder:text-muted"
        name="name"
        placeholder="Escribe tu nombre"
        autocomplete="name"
        required
        :disabled="busy"
      >
      <button
        class="min-h-[44px] shrink-0 rounded-control bg-accent-active px-4 py-2 text-canvas shadow-subtle transition-colors duration-200 hover:bg-ink active:bg-ink disabled:cursor-not-allowed disabled:opacity-50"
        type="submit"
        :disabled="busy || !name.trim()"
      >
        {{ busy ? 'Entrando...' : 'Continuar' }}
      </button>
    </form>
  </section>
</template>
