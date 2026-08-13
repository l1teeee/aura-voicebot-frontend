<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { MessageCircleMore, MessagesSquare, X } from 'lucide'
import { MorphIcon } from 'morphicons/vue'
import type { Message } from '@/domain/types'

const props = withDefaults(defineProps<{
  id: string
  triggerId: string
  messages: Message[]
  interimTranscript?: string
  open?: boolean
}>(), {
  interimTranscript: '',
  open: false,
})

const emit = defineEmits<{
  close: []
  closed: []
}>()

const hasContent = computed(() => props.messages.length > 0 || props.interimTranscript.trim() !== '')
const headingIcon = computed(() => hasContent.value ? MessagesSquare : MessageCircleMore)
const transcriptMeta = computed(() => {
  if (props.interimTranscript.trim()) return 'Escuchando'
  return props.messages.length === 1 ? '1 mensaje' : `${props.messages.length} mensajes`
})

const scrollEl = ref<HTMLElement | null>(null)
const panelEl = ref<HTMLElement | null>(null)
const closeButton = ref<HTMLButtonElement | null>(null)
let focusReturnTarget: HTMLElement | null = null

const FOCUSABLE_SELECTOR = [
  'button:not(:disabled)',
  '[href]',
  'input:not(:disabled)',
  'select:not(:disabled)',
  'textarea:not(:disabled)',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

function speaker(message: Message): string {
  return message.role === 'user' ? 'Tú' : 'Aura'
}

async function scrollToEnd(force = false): Promise<void> {
  const current = scrollEl.value
  if (!current) return

  const shouldFollow = force
    || current.scrollHeight - current.scrollTop - current.clientHeight < 48

  await nextTick()
  if (scrollEl.value && shouldFollow) scrollEl.value.scrollTop = scrollEl.value.scrollHeight
}

function requestClose(): void {
  emit('close')
}

function handleKeydown(event: KeyboardEvent): void {
  if (!props.open) return

  if (event.key === 'Escape') {
    event.preventDefault()
    requestClose()
    return
  }

  if (event.key !== 'Tab' || !panelEl.value) return

  const focusable = Array.from(
    panelEl.value.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
  ).filter((element) => element.getClientRects().length > 0)
  if (focusable.length === 0) return

  const first = focusable[0]
  const last = focusable[focusable.length - 1]
  const active = document.activeElement
  const focusIsOutside = !(active instanceof Node) || !panelEl.value.contains(active)

  if (event.shiftKey && (active === first || focusIsOutside)) {
    event.preventDefault()
    last?.focus()
  } else if (!event.shiftKey && (active === last || focusIsOutside)) {
    event.preventDefault()
    first?.focus()
  }
}

function restoreFocus(): void {
  if (focusReturnTarget?.isConnected) {
    focusReturnTarget.focus()
  }
  focusReturnTarget = null
}

function handleAfterLeave(): void {
  restoreFocus()
  emit('closed')
}

watch(
  () => props.open,
  async (isOpen) => {
    if (isOpen) {
      const trigger = document.getElementById(props.triggerId)
      focusReturnTarget = trigger instanceof HTMLElement
        ? trigger
        : document.activeElement instanceof HTMLElement ? document.activeElement : null
      await nextTick()
      const visibleCloseButton = closeButton.value?.getClientRects().length
        ? closeButton.value
        : null
      visibleCloseButton?.focus()
      await scrollToEnd(true)
    }
  },
)

watch([() => props.messages.length, () => props.interimTranscript], () => {
  if (props.open) void scrollToEnd()
})

onMounted(() => {
  window.addEventListener('keydown', handleKeydown)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleKeydown)
})
</script>

<template>
  <Transition
    name="voice-transcript-dock"
    @after-leave="handleAfterLeave"
  >
    <div
      v-if="open"
      class="voice-transcript-dock"
    >
      <section
        :id="id"
        ref="panelEl"
        class="voice-transcript"
        role="dialog"
        aria-modal="true"
        aria-label="Lo hablado con Aura"
      >
        <header class="voice-transcript__header">
          <span
            class="voice-transcript__heading-icon"
            aria-hidden="true"
          >
            <MorphIcon
              :icon="headingIcon"
              :size="17"
              :stroke-width="1.7"
              spring="smooth"
              reduced-motion="user"
            />
          </span>
          <h2>Lo hablado</h2>
          <span class="voice-transcript__meta">{{ transcriptMeta }}</span>

          <button
            ref="closeButton"
            class="voice-transcript__close"
            type="button"
            aria-label="Cerrar lo hablado"
            @click="requestClose"
          >
            <MorphIcon
              :icon="X"
              :size="18"
              :stroke-width="1.9"
              spring="snappy"
              reduced-motion="user"
            />
          </button>
        </header>

        <div
          ref="scrollEl"
          class="voice-transcript__body"
        >
          <ol
            v-if="hasContent"
            class="voice-transcript__list"
            aria-label="Transcripción completa"
          >
            <li
              v-for="message in messages"
              :key="message.id"
              class="voice-transcript__item"
              :class="message.role === 'user'
                ? 'voice-transcript__item--user'
                : 'voice-transcript__item--aura'"
            >
              <p class="voice-transcript__speaker">
                {{ speaker(message) }}
              </p>
              <p class="voice-transcript__text">
                {{ message.text }}
              </p>
            </li>
            <li
              v-if="interimTranscript.trim()"
              class="voice-transcript__item voice-transcript__item--interim"
              aria-live="off"
            >
              <p class="voice-transcript__speaker">
                Tú, hablando
              </p>
              <p class="voice-transcript__text">
                {{ interimTranscript }}
              </p>
            </li>
          </ol>

          <p
            v-else
            class="voice-transcript__empty"
          >
            Cuando hables con Aura, aquí verás la transcripción completa.
          </p>
        </div>
      </section>
    </div>
  </Transition>
</template>

<style scoped>
.voice-transcript-dock {
  position: relative;
  z-index: 50;
  width: min(88vw, 360px);
  height: 100%;
  flex: none;
  overflow: hidden;
}

.voice-transcript {
  display: grid;
  width: min(88vw, 360px);
  height: 100%;
  flex: none;
  grid-template-rows: auto minmax(0, 1fr);
  overflow: hidden;
  box-sizing: border-box;
  border-left: 1px solid var(--aura-sidebar-border);
  background: var(--aura-sidebar-surface);
  text-align: left;
}

.voice-transcript__header {
  display: flex;
  min-height: 64px;
  align-items: center;
  gap: 0.5rem;
  padding: 0.9rem 1.15rem;
  border-bottom: 1px solid var(--aura-sidebar-divider);
}

.voice-transcript__heading-icon {
  display: grid;
  flex: none;
  place-items: center;
  color: var(--aura-sidebar-muted);
}

.voice-transcript__heading-icon svg {
  width: 1.05rem;
  height: 1.05rem;
}

.voice-transcript__header h2 {
  overflow: hidden;
  margin: 0;
  color: var(--aura-sidebar-ink);
  font-size: 0.84rem;
  font-weight: 600;
  letter-spacing: -0.005em;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Salida explicita: en movil el panel cubre el ancho completo y el scrim que
   cierra los docks queda tapado. */
.voice-transcript__close {
  display: inline-grid;
  width: 40px;
  height: 40px;
  flex: none;
  place-items: center;
  margin-right: -0.45rem;
  padding: 0;
  border: 0;
  border-radius: 10px;
  background: transparent;
  color: var(--aura-sidebar-muted);
  transition: background-color var(--aura-duration-hover) var(--aura-ease-soft);
}

.voice-transcript__close:hover {
  background: var(--aura-sidebar-hover);
  color: var(--aura-sidebar-ink);
}

.voice-transcript__meta {
  flex: none;
  margin: 0 0 0 auto;
  color: var(--aura-sidebar-faint);
  font-size: 0.72rem;
  font-weight: 500;
  white-space: nowrap;
}

.voice-transcript__body {
  min-height: 0;
  overflow-y: auto;
  background: var(--aura-sidebar-surface);
  scrollbar-color: rgb(5 52 56 / 0.2) transparent;
  scrollbar-width: thin;
}

.voice-transcript__body::-webkit-scrollbar {
  width: 6px;
}

.voice-transcript__body::-webkit-scrollbar-thumb {
  border-radius: 3px;
  background: rgb(5 52 56 / 0.2);
}

.voice-transcript__body::-webkit-scrollbar-track {
  background: transparent;
}

.voice-transcript__list {
  margin: 0;
  padding: 0.4rem 1.15rem 1.75rem;
  list-style: none;
}

.voice-transcript__item {
  position: relative;
  padding: 0.95rem 0 1rem 0.85rem;
  border-bottom: 1px solid var(--aura-sidebar-divider);
  animation: voice-transcript-appear 260ms var(--aura-ease-soft) both;
}

.voice-transcript__item:last-child {
  border-bottom: none;
}

.voice-transcript__item--aura::before {
  position: absolute;
  top: 1.05rem;
  bottom: 1.1rem;
  left: 0;
  width: 2px;
  border-radius: 1px;
  background: var(--aura-teal);
  content: '';
  opacity: 0.5;
}

.voice-transcript__speaker,
.voice-transcript__text,
.voice-transcript__empty {
  margin: 0;
}

.voice-transcript__speaker {
  color: var(--aura-sidebar-faint);
  font-size: 0.66rem;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.voice-transcript__item--aura .voice-transcript__speaker {
  color: rgb(4 75 57 / 0.62);
}

.voice-transcript__text {
  margin-top: 0.35rem;
  color: var(--aura-sidebar-ink);
  font-size: 0.9rem;
  line-height: 1.62;
}

.voice-transcript__item--interim {
  margin-top: 0.4rem;
  padding-right: 0.75rem;
  border-bottom: none;
  border-radius: 10px;
  background: var(--aura-sidebar-active);
}

.voice-transcript__item--interim .voice-transcript__text {
  color: var(--aura-sidebar-muted);
  font-style: italic;
}

.voice-transcript__empty {
  padding: 3rem 1.75rem;
  color: var(--aura-sidebar-muted);
  font-size: 0.86rem;
  line-height: 1.6;
  text-align: center;
  text-wrap: pretty;
}

@keyframes voice-transcript-appear {
  from {
    opacity: 0;
    transform: translateY(4px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.voice-transcript-dock-enter-active,
.voice-transcript-dock-leave-active {
  transition: width var(--aura-duration-drawer) var(--aura-ease-drawer);
  will-change: width;
}

.voice-transcript-dock-leave-active {
  pointer-events: none;
}

.voice-transcript-dock-enter-active .voice-transcript,
.voice-transcript-dock-leave-active .voice-transcript {
  transition:
    transform var(--aura-duration-drawer) var(--aura-ease-drawer),
    opacity var(--aura-duration-drawer) var(--aura-ease-soft);
  will-change: transform, opacity;
}

.voice-transcript-dock-enter-from,
.voice-transcript-dock-leave-to {
  width: 0;
}

.voice-transcript-dock-enter-from .voice-transcript,
.voice-transcript-dock-leave-to .voice-transcript {
  opacity: 0;
  transform: translateX(100%);
}

@media (min-width: 641px) {
  .voice-transcript__close {
    display: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .voice-transcript-dock-enter-active,
  .voice-transcript-dock-leave-active,
  .voice-transcript-dock-enter-active .voice-transcript,
  .voice-transcript-dock-leave-active .voice-transcript {
    transition: none;
  }

  .voice-transcript__item {
    animation: none;
  }
}
</style>
