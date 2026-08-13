<script setup lang="ts">
import { ref } from 'vue'

defineProps<{ busy?: boolean }>()
const emit = defineEmits<{ identify: [name: string]; anonymous: [] }>()
const name = ref('')
</script>

<template>
  <section class="border border-edge p-5">
    <p class="text-sm text-ink">
      Coloca tu nombre de usuario para iniciar la sesion.
    </p>
    <p class="mt-1 text-sm text-muted">
      Guardaremos tu nombre para recuperar tus conversaciones.
    </p>
    <form
      class="mt-4 flex gap-2"
      @submit.prevent="emit('identify', name)"
    >
      <input
        v-model="name"
        class="min-w-0 flex-1 border-b border-edge bg-transparent px-1 py-2 text-ink outline-none"
        placeholder="Tu nombre"
        autocomplete="name"
        :disabled="busy"
      >
      <button
        class="px-3 py-2 text-sm text-accent"
        type="submit"
        :disabled="busy || !name.trim()"
      >
        Continuar
      </button>
    </form>
    <button
      class="mt-3 text-xs text-muted underline"
      type="button"
      :disabled="busy"
      @click="emit('anonymous')"
    >
      Continuar sin nombre
    </button>
  </section>
</template>
