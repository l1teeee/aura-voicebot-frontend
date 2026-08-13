<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import type { ConversationStatus } from '@/domain/types'
import TextFallbackInput from './TextFallbackInput.vue'

const props = withDefaults(defineProps<{
  status: ConversationStatus
  canRepeat: boolean
  // Se fuerza cuando el microfono no esta disponible: el compositor queda
  // abierto y no se puede cerrar desde la barra.
  forceComposer?: boolean
  imagePending?: boolean
}>(), {
  forceComposer: false,
  imagePending: false,
})

const emit = defineEmits<{
  submit: [text: string]
  repeat: []
  end: []
  attachImage: [file: File]
}>()

const fileInputRef = ref<HTMLInputElement | null>(null)
const canAttachImage = computed(() => props.status !== 'processing' && !props.imagePending)

function triggerImagePicker(): void {
  if (!canAttachImage.value) return
  fileInputRef.value?.click()
}

function handleFileChange(event: Event): void {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  emit('attachImage', file)
}

const CONFIRM_TIMEOUT_MS = 3200

const composerOpenState = ref(props.forceComposer)
const confirmingEnd = ref(false)
let confirmTimer: ReturnType<typeof setTimeout> | null = null

// composerOpen combina el estado manual con el forzado por el padre.
const composerOpen = computed(() => composerOpenState.value || props.forceComposer)

// Si el microfono se vuelve indisponible mientras se conversa, el compositor
// queda marcado como abierto (sticky) aunque luego forceComposer se apague.
watch(
  () => props.forceComposer,
  (forced) => {
    if (forced) composerOpenState.value = true
  },
)

function toggleComposer(): void {
  if (props.forceComposer) return
  composerOpenState.value = !composerOpenState.value
}

function handleComposerSubmit(text: string): void {
  emit('submit', text)
  if (!props.forceComposer) {
    composerOpenState.value = false
  }
}

function clearConfirmTimer(): void {
  if (confirmTimer !== null) {
    clearTimeout(confirmTimer)
    confirmTimer = null
  }
}

function handleEndClick(): void {
  if (confirmingEnd.value) {
    clearConfirmTimer()
    confirmingEnd.value = false
    emit('end')
    return
  }

  confirmingEnd.value = true
  confirmTimer = setTimeout(() => {
    confirmingEnd.value = false
    confirmTimer = null
  }, CONFIRM_TIMEOUT_MS)
}

onUnmounted(() => {
  clearConfirmTimer()
})
</script>

<template>
  <div class="voice-action-bar-wrap">
    <Transition name="composer">
      <div
        v-if="composerOpen"
        id="voice-action-composer"
        class="voice-action-bar__composer"
      >
        <TextFallbackInput
          :disabled="status === 'processing'"
          @submit="handleComposerSubmit"
        />
      </div>
    </Transition>

    <div
      class="voice-action-bar"
      role="toolbar"
      aria-label="Acciones de la conversación"
    >
      <button
        type="button"
        class="voice-action-bar__button"
        :class="{ 'is-active': composerOpen }"
        :aria-pressed="composerOpen"
        :aria-expanded="composerOpen"
        aria-controls="voice-action-composer"
        :disabled="forceComposer"
        :aria-label="forceComposer
          ? 'Compositor de texto abierto porque el micrófono no está disponible'
          : (composerOpen ? 'Cerrar el compositor de texto' : 'Escribir un mensaje')"
        @click="toggleComposer"
      >
        <svg
          class="voice-action-bar__icon"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.6"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M12 20h9" />
          <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
        </svg>
        <span class="voice-action-bar__label">Escribir</span>
      </button>

      <button
        type="button"
        class="voice-action-bar__button"
        :disabled="!canRepeat"
        aria-label="Repetir la última respuesta"
        @click="emit('repeat')"
      >
        <svg
          class="voice-action-bar__icon"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.6"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M3 12a9 9 0 0 1 15.5-6.3L21 8" />
          <path d="M21 3v5h-5" />
          <path d="M21 12a9 9 0 0 1-15.5 6.3L3 16" />
          <path d="M3 21v-5h5" />
        </svg>
        <span class="voice-action-bar__label">Repetir</span>
      </button>

      <button
        type="button"
        class="voice-action-bar__button"
        :disabled="!canAttachImage"
        :aria-label="imagePending ? 'Enviando foto' : 'Adjuntar una foto'"
        @click="triggerImagePicker"
      >
        <svg
          class="voice-action-bar__icon"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.6"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M13.997 4a2 2 0 0 1 1.76 1.05l.486.9A2 2 0 0 0 18.003 7H20a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h1.997a2 2 0 0 0 1.759-1.048l.489-.904A2 2 0 0 1 10.004 4z" />
          <circle
            cx="12"
            cy="13"
            r="3"
          />
        </svg>
        <span class="voice-action-bar__label">{{ imagePending ? 'Enviando…' : 'Foto' }}</span>
      </button>

      <input
        ref="fileInputRef"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        capture="environment"
        class="sr-only"
        tabindex="-1"
        aria-hidden="true"
        @change="handleFileChange"
      >

      <button
        type="button"
        class="voice-action-bar__button"
        :class="{ 'is-confirming': confirmingEnd }"
        :aria-label="confirmingEnd ? 'Confirmar el inicio de una conversación nueva' : 'Terminar la conversación actual'"
        @click="handleEndClick"
      >
        <svg
          class="voice-action-bar__icon"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.6"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M12 3v8" />
          <path d="M7 5.5a8 8 0 1 0 10 0" />
        </svg>
        <span class="voice-action-bar__label">{{ confirmingEnd ? '¿Seguro?' : 'Terminar' }}</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
/* Sticky y no absolute: el contenedor de la vista tiene overflow-y auto, asi
   que una barra absoluta se iria con el scroll en pantallas bajas. El margen
   negativo la mete dentro del padding-bottom que reserva la escena, para no
   sumar altura desplazable. */
.voice-action-bar-wrap {
  position: sticky;
  z-index: 20;
  bottom: 1rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.6rem;
  margin-top: -5rem;
  padding: 0 1rem;
  pointer-events: none;
}

.voice-action-bar-wrap > * {
  pointer-events: auto;
}

.voice-action-bar__composer {
  width: min(100%, 30rem);
  padding: 0.65rem 0.75rem;
  border: 1px solid rgb(5 52 56 / 0.08);
  border-radius: 18px;
  background: rgb(255 255 255 / 0.86);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  box-shadow: 0 10px 26px rgb(5 52 56 / 0.1);
}

.voice-action-bar {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  box-sizing: border-box;
  height: 64px;
  padding: 0 0.6rem;
  border: 1px solid rgb(5 52 56 / 0.08);
  border-radius: 20px;
  background: rgb(255 255 255 / 0.72);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  box-shadow: 0 10px 26px rgb(5 52 56 / 0.1);
}

.voice-action-bar__button {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 0.4rem;
  height: 44px;
  padding: 0 0.85rem;
  border: 0;
  border-radius: 10px;
  background: transparent;
  color: var(--aura-forest);
  font-size: 0.82rem;
  font-weight: 600;
  white-space: nowrap;
  transition: background-color var(--aura-duration-hover) var(--aura-ease-soft);
}

.voice-action-bar__button:hover:not(:disabled) {
  background: rgb(5 52 56 / 0.06);
}

.voice-action-bar__button:active:not(:disabled) {
  background: rgb(5 52 56 / 0.1);
}

.voice-action-bar__button:disabled {
  opacity: 0.4;
}

.voice-action-bar__button.is-active {
  background: var(--aura-sidebar-active);
}

.voice-action-bar__button.is-confirming {
  background: rgb(5 52 56 / 0.08);
  color: var(--aura-moss);
}

.voice-action-bar__icon {
  width: 1.15rem;
  height: 1.15rem;
  flex: none;
}

.voice-action-bar__label {
  overflow: hidden;
  text-overflow: ellipsis;
}

.composer-enter-active,
.composer-leave-active {
  transition: opacity 200ms ease-out, transform 220ms cubic-bezier(0.22, 1, 0.36, 1);
}

.composer-enter-from,
.composer-leave-to {
  opacity: 0;
  transform: translateY(8px);
}

@media (max-width: 640px) {
  .voice-action-bar-wrap {
    bottom: 0.75rem;
    margin-top: -4.75rem;
    padding: 0 0.6rem;
  }

  .voice-action-bar {
    width: 100%;
  }

  .voice-action-bar__button {
    flex: 1;
    justify-content: center;
    padding: 0 0.4rem;
    font-size: 0.76rem;
  }
}

@media (prefers-reduced-motion: reduce) {
  .composer-enter-active,
  .composer-leave-active {
    transition: none;
  }
}
</style>
