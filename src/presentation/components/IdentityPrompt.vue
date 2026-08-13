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
      Usamos tu nombre para guardar tus consultas del clima y la naturaleza, y retomarlas cuando quieras.
    </p>
    <form
      class="mt-6"
      :aria-busy="busy"
      @submit.prevent="emit('identify', name.trim())"
    >
      <label
        class="identity-label"
        for="aura-display-name"
      >
        Tu nombre
      </label>
      <input
        id="aura-display-name"
        v-model="name"
        class="identity-input"
        name="name"
        placeholder="Escribe cómo quieres que te llamemos"
        autocomplete="name"
        required
        :disabled="busy"
      >
      <button
        class="identity-submit"
        type="submit"
        :disabled="busy || !name.trim()"
      >
        <span>{{ busy ? 'Entrando...' : 'Continuar' }}</span>
      </button>
    </form>
  </section>
</template>

<style scoped>
.identity-label {
  display: block;
  margin-bottom: 0.6rem;
  color: rgb(5 52 56 / 0.68);
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.identity-input {
  width: 100%;
  padding: 0.8rem 1rem;
  color: var(--aura-ink);
}

.identity-input::placeholder {
  color: rgb(5 52 56 / 0.42);
}

.identity-input:focus-visible {
  outline: 3px solid var(--aura-teal) !important;
}

.identity-submit {
  position: relative;
  width: 100%;
  min-height: 52px;
  margin-top: 1rem;
  overflow: hidden;
  border: 0;
  border-radius: var(--aura-radius-control);
  background: var(--aura-forest);
  box-shadow: 0 12px 26px rgb(4 75 57 / 0.2);
  color: var(--aura-white);
}

.identity-submit::before {
  position: absolute;
  inset: -50%;
  border-radius: 50%;
  background: radial-gradient(circle, var(--aura-teal) 0 34%, transparent 68%);
  content: '';
  opacity: 0;
  transform: translateX(-28%) scale(0.65);
  transition: opacity 260ms ease, transform 500ms cubic-bezier(0.22, 1, 0.36, 1);
}

.identity-submit span {
  position: relative;
  z-index: 1;
}

.identity-submit:hover:not(:disabled)::before {
  opacity: 1;
  transform: translateX(28%) scale(1.1);
}

.identity-submit:disabled {
  box-shadow: none;
  opacity: 0.55;
}

@media (prefers-reduced-motion: reduce) {
  .identity-submit::before {
    transition: none;
  }
}
</style>
