<script setup lang="ts">
import { ref } from 'vue'

defineProps<{ busy?: boolean }>()
const emit = defineEmits<{ identify: [name: string]; anonymous: [] }>()
const name = ref('')
</script>

<template>
  <section class="rounded-card border border-edge bg-canvas p-5 shadow-subtle sm:p-6">
    <span class="inline-flex rounded-full bg-surface px-3 py-1 text-xs font-semibold text-ink">
      Bienvenido a Aura
    </span>
    <h2 class="mt-4 text-xl font-semibold tracking-tight text-ink">
      ¿Cómo te gustaría que te llamemos?
    </h2>
    <p class="mt-2 text-sm leading-relaxed text-muted">
      Usaremos tu nombre para que la conversación se sienta más cercana y puedas recuperarla después.
    </p>
    <form
      class="mt-5 flex flex-col gap-2 sm:flex-row"
      @submit.prevent="emit('identify', name)"
    >
      <input
        v-model="name"
        class="min-w-0 flex-1 border border-edge bg-transparent px-4 py-2 text-ink outline-none"
        placeholder="Tu nombre"
        aria-label="Tu nombre"
        autocomplete="name"
        :disabled="busy"
      >
      <button
        class="min-h-[48px] rounded-control bg-ink px-5 py-2 text-sm font-semibold text-canvas shadow-subtle disabled:opacity-50"
        type="submit"
        :disabled="busy || !name.trim()"
      >
        {{ busy ? 'Entrando…' : 'Continuar' }}
      </button>
    </form>
    <button
      class="mt-3 inline-flex min-h-[44px] items-center text-xs font-medium text-muted underline underline-offset-4"
      type="button"
      :disabled="busy"
      @click="emit('anonymous')"
    >
      Continuar sin nombre
    </button>
  </section>
</template>
