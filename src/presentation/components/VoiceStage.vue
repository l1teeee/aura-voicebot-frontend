<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { ConversationStatus, Message } from '@/domain/types'
import { headlineForSession } from '@/presentation/copy/headlines'
import AuraOrb from './AuraOrb.vue'

const props = withDefaults(defineProps<{
  sessionId: string
  messages: Message[]
  status: ConversationStatus
  audioLevel: number
  micBlocked: boolean
  needsTextFallback: boolean
  interimTranscript?: string
}>(), {
  interimTranscript: '',
})

const emit = defineEmits<{
  activate: []
}>()

const stateCopy: Record<ConversationStatus, string> = {
  idle: 'Toca para hablar y cuéntame lo que tienes en mente.',
  listening: 'Te escucho.',
  processing: 'Estoy preparando una respuesta.',
  speaking: 'Aura te está respondiendo.',
  error: 'Algo no salió como esperábamos. Puedes intentarlo de nuevo.',
}

const hasMessages = computed(() => props.messages.length > 0)
const greeting = computed(() => headlineForSession(props.sessionId))

const transcript = computed(() => props.interimTranscript.trim())

// Abajo del orbe se lee el ultimo intercambio: lo dicho por la persona como
// comentario tenue y la respuesta de Aura con peso.
const exchange = computed(() => {
  // Solo mientras Aura habla se sugiere que tocar el orbe la interrumpe.
  const hint = props.status === 'speaking' ? 'Toca el orbe para detener' : ''

  if (transcript.value) {
    return { said: transcript.value, reply: '', isHint: false, hint }
  }

  const latest = props.messages.at(-1)
  if (!latest) {
    return { said: '', reply: stateCopy[props.status], isHint: true, hint }
  }

  if (latest.role === 'user') {
    return {
      said: latest.text,
      reply: props.status === 'processing' ? stateCopy.processing : '',
      isHint: true,
      hint,
    }
  }

  const previous = props.messages.at(-2)
  return {
    said: previous?.role === 'user' ? previous.text : '',
    reply: latest.text,
    isHint: false,
    hint,
  }
})
// El texto largo se recorta a tres lineas; el boton solo aparece si de verdad
// sobra contenido, medido contra la altura real del parrafo.
const EXPAND_DURATION_MS = 340

const liveCopyEl = ref<HTMLElement | null>(null)
const replyEl = ref<HTMLElement | null>(null)
const replyExpanded = ref(false)
const replyOverflows = ref(false)
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
let replyResizeObserver: ResizeObserver | null = null
let replyAnimation: Animation | null = null
let collapsedHeight = 0

function measureReply(): void {
  if (replyExpanded.value) return

  const element = replyEl.value
  replyOverflows.value = element !== null && element.scrollHeight - element.clientHeight > 2
  collapsedHeight = element?.getBoundingClientRect().height ?? 0
}

// La altura recortada y la expandida se animan a mano: no hay transicion CSS
// posible entre un line-clamp y el alto real del texto.
function toggleReply(): void {
  const element = replyEl.value
  const shouldExpand = !replyExpanded.value

  if (element === null || prefersReducedMotion.matches) {
    replyExpanded.value = shouldExpand
    if (!shouldExpand) measureReply()
    return
  }

  if (shouldExpand) {
    collapsedHeight = element.getBoundingClientRect().height
    replyExpanded.value = true
    void nextTick(() => {
      animateReplyHeight(element, collapsedHeight, element.getBoundingClientRect().height)
    })
    return
  }

  // Al plegar se conserva el texto completo hasta el final de la animacion,
  // asi el recorte no aparece de golpe con la caja todavia abierta.
  const expandedHeight = element.getBoundingClientRect().height
  animateReplyHeight(element, expandedHeight, collapsedHeight, () => {
    replyExpanded.value = false
    void nextTick(measureReply)
  })
}

function animateReplyHeight(
  element: HTMLElement,
  from: number,
  to: number,
  onDone?: () => void,
): void {
  replyAnimation?.cancel()
  element.style.overflowY = 'hidden'

  replyAnimation = element.animate(
    [{ height: `${from}px` }, { height: `${to}px` }],
    { duration: EXPAND_DURATION_MS, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' },
  )

  replyAnimation.onfinish = () => {
    replyAnimation = null
    element.style.overflowY = ''
    onDone?.()
  }
}

// Al cambiar la respuesta se limpia el estado: el boton lo vuelve a encender
// after-enter una vez montado el parrafo nuevo, ya con su altura real.
watch(() => exchange.value.reply, () => {
  replyExpanded.value = false
  replyOverflows.value = false
})

onMounted(() => {
  // Observa el contenedor y no la ventana: el ancho tambien cambia al abrir
  // los paneles laterales.
  replyResizeObserver = new ResizeObserver(measureReply)
  if (liveCopyEl.value !== null) replyResizeObserver.observe(liveCopyEl.value)
})

onBeforeUnmount(() => {
  replyResizeObserver?.disconnect()
  replyResizeObserver = null
  replyAnimation?.cancel()
  replyAnimation = null
})

const orbDisabled = computed(() => props.micBlocked)
const disabledReason = computed(() => {
  if (!props.micBlocked) return undefined
  return props.needsTextFallback
    ? 'El micrófono no está disponible. Usa el campo de texto.'
    : 'Activa el micrófono para hablar con Aura.'
})
</script>

<template>
  <section
    class="voice-stage"
    :aria-labelledby="!hasMessages ? 'voice-stage-title' : undefined"
    :aria-label="hasMessages ? 'Conversación con Aura' : undefined"
  >
    <div class="voice-stage__center">
      <Transition
        name="voice-headline"
        mode="out-in"
        appear
      >
        <div
          v-if="!hasMessages"
          :key="`welcome-${sessionId}`"
          class="voice-stage__welcome"
        >
          <div class="voice-stage__welcome-inner">
            <h2 id="voice-stage-title">
              {{ greeting }}
            </h2>
            <p class="voice-stage__intro">
              Estoy aquí para escucharte, ayudarte a pensar o resolver algo contigo.
            </p>
          </div>
        </div>
      </Transition>

      <div
        class="voice-stage__orb-wrap"
      >
        <AuraOrb
          :status="status"
          :audio-level="audioLevel"
          :disabled="orbDisabled"
          :disabled-reason="disabledReason"
          size="clamp(10.5rem, 42vw, 14rem)"
          @activate="emit('activate')"
        />
      </div>

      <div
        id="aura-voice-status"
        ref="liveCopyEl"
        class="voice-stage__live-copy"
        :role="transcript ? undefined : 'status'"
        :aria-live="transcript ? 'off' : 'polite'"
        aria-atomic="true"
      >
        <Transition
          name="live-line"
          mode="out-in"
        >
          <p
            v-if="exchange.said"
            :key="exchange.said"
            class="voice-stage__said"
            :class="{ 'is-live': transcript !== '' }"
          >
            {{ exchange.said }}
          </p>
        </Transition>

        <Transition
          name="live-line"
          mode="out-in"
          @after-enter="measureReply"
        >
          <p
            v-if="exchange.reply"
            id="aura-voice-reply"
            ref="replyEl"
            :key="exchange.reply"
            class="voice-stage__reply"
            :class="{ 'is-hint': exchange.isHint, 'is-expanded': replyExpanded }"
          >
            {{ exchange.reply }}
          </p>
        </Transition>

        <button
          v-if="replyOverflows || replyExpanded"
          type="button"
          class="voice-stage__more"
          aria-controls="aura-voice-reply"
          :aria-expanded="replyExpanded"
          aria-live="off"
          @click="toggleReply"
        >
          {{ replyExpanded ? 'Ver menos' : 'Ver todo' }}
        </button>

        <Transition
          name="live-line"
          mode="out-in"
        >
          <p
            v-if="exchange.hint"
            :key="exchange.hint"
            class="voice-stage__hint"
            aria-hidden="true"
          >
            {{ exchange.hint }}
          </p>
        </Transition>
      </div>

      <div
        v-if="$slots['weather-card']"
        class="voice-stage__slot"
      >
        <slot name="weather-card" />
      </div>

      <div
        v-if="$slots.permission"
        class="voice-stage__slot"
      >
        <slot name="permission" />
      </div>
      <div
        v-if="$slots.error"
        class="voice-stage__slot"
      >
        <slot name="error" />
      </div>

      <div
        v-if="$slots.fallback"
        class="voice-stage__slot"
      >
        <slot name="fallback" />
      </div>
    </div>
  </section>
</template>

<style scoped>
.voice-stage {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  min-height: 100%;
  align-items: center;
  gap: clamp(1rem, 3vh, 2rem);
  padding: clamp(1rem, 4vh, 3rem) 1rem;
  /* deja libre la barra de acciones fija anclada abajo */
  padding-bottom: 6rem;
  text-align: center;
}

.voice-stage__center {
  display: flex;
  width: min(100%, 43rem);
  flex-direction: column;
  align-items: center;
  justify-self: center;
}

.voice-stage__welcome {
  display: grid;
  width: 100%;
  grid-template-rows: 1fr;
}

.voice-stage__welcome-inner {
  min-height: 0;
  overflow: hidden;
}

.voice-stage__welcome-inner {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.voice-headline-enter-active {
  transition:
    grid-template-rows 320ms cubic-bezier(0.22, 1, 0.36, 1),
    opacity 220ms ease-out,
    transform 320ms cubic-bezier(0.22, 1, 0.36, 1);
}

.voice-headline-leave-active {
  transition:
    grid-template-rows 200ms ease-in,
    opacity 160ms ease-in,
    transform 200ms ease-in;
}

.voice-headline-enter-from,
.voice-headline-leave-to {
  grid-template-rows: 0fr;
  opacity: 0;
}

.voice-headline-enter-from {
  transform: translateY(8px);
}

.voice-headline-leave-to {
  transform: translateY(-5px);
}

.voice-stage__intro,
.voice-stage__said,
.voice-stage__reply,
.voice-stage__hint {
  margin: 0;
}

.voice-stage h2 {
  max-width: 28rem;
  margin: 0;
  color: #053438;
  font-size: clamp(2rem, 4.5vw, 3.25rem);
  font-weight: 700;
  letter-spacing: -0.06em;
  line-height: 0.98;
}

.voice-stage__intro {
  max-width: 32rem;
  margin-top: 0.9rem;
  color: rgb(5 52 56 / 0.68);
  font-size: clamp(0.92rem, 1.5vw, 1rem);
  line-height: 1.55;
}

.voice-stage__slot {
  width: min(100%, 36rem);
  margin-top: 1rem;
  text-align: left;
}

.voice-stage__orb-wrap {
  display: grid;
  min-height: clamp(12rem, 28vw, 17rem);
  margin-top: clamp(0.75rem, 2.5vh, 1.5rem);
  place-items: center;
  transition:
    min-height 360ms cubic-bezier(0.22, 1, 0.36, 1),
    margin-top 360ms cubic-bezier(0.22, 1, 0.36, 1);
}

.voice-stage__live-copy {
  display: grid;
  /* said (2 lineas) + reply (2 lineas) + hint, para que no salte al pasar por speaking */
  min-height: 5.75rem;
  max-width: min(100%, 34rem);
  align-content: start;
  justify-items: center;
  gap: 0.45rem;
  margin-top: 1.75rem;
  color: #053438;
}

/* Lo que dice la persona: comentario tenue */
.voice-stage__said {
  overflow: hidden;
  display: -webkit-box;
  max-width: 30rem;
  color: rgb(5 52 56 / 0.52);
  font-size: 0.82rem;
  line-height: 1.45;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.voice-stage__said.is-live {
  color: rgb(5 52 56 / 0.62);
}

/* Lo que responde Aura: pesa mas */
.voice-stage__reply {
  overflow: hidden;
  display: -webkit-box;
  max-width: 34rem;
  color: rgb(5 52 56 / 0.88);
  font-size: clamp(1rem, 1.8vw, 1.2rem);
  line-height: 1.5;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
}

/* Expandido: se suelta el recorte y se limita la altura para no empujar el
   texto por debajo de la barra de acciones. */
.voice-stage__reply.is-expanded {
  display: block;
  overflow-y: auto;
  max-height: 42vh;
  scrollbar-color: rgb(5 52 56 / 0.22) transparent;
  scrollbar-width: thin;
  -webkit-line-clamp: none;
}

.voice-stage__reply.is-hint {
  color: rgb(5 52 56 / 0.45);
  font-size: 0.84rem;
}

.voice-stage__more {
  min-height: 32px;
  padding: 0.2rem 0.6rem;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: rgb(5 52 56 / 0.55);
  font-size: 0.74rem;
  font-weight: 600;
  letter-spacing: 0.02em;
  transition: background-color 160ms ease, color 160ms ease;
}

.voice-stage__more:hover {
  background: rgb(5 52 56 / 0.06);
  color: rgb(5 52 56 / 0.82);
}

/* Aviso tenue de que se puede tocar el orbe para interrumpir a Aura */
.voice-stage__hint {
  color: rgb(5 52 56 / 0.4);
  font-size: 0.72rem;
  letter-spacing: 0.03em;
}

.live-line-enter-active {
  transition: opacity 240ms ease-out, transform 280ms cubic-bezier(0.22, 1, 0.36, 1);
}

.live-line-leave-active {
  transition: opacity 140ms ease-in, transform 160ms ease-in;
}

.live-line-enter-from {
  opacity: 0;
  transform: translateY(5px);
}

.live-line-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

@media (max-height: 740px) and (min-width: 641px) {
  .voice-stage {
    align-items: flex-start;
  }

  .voice-stage__orb-wrap {
    min-height: 10.5rem;
    margin-top: 0.6rem;
  }
}

@media (max-width: 640px) {
  /* safe center: si el contenido llega a ser mas alto que la pantalla, se
     comporta como flex-start y el inicio sigue siendo alcanzable al hacer
     scroll, en vez de recortarse por arriba. */
  .voice-stage {
    align-items: safe center;
    padding-top: 4.5rem;
  }

  .voice-stage h2 {
    max-width: 19rem;
  }

  .voice-stage__orb-wrap {
    min-height: 11.5rem;
    margin-top: 0.5rem;
  }

  .voice-stage__live-copy {
    margin-top: 1.25rem;
  }

  .voice-stage__said {
    font-size: 0.8rem;
  }

  .voice-stage__reply {
    font-size: 1.02rem;
  }
}

@media (prefers-reduced-motion: reduce) {
  .voice-headline-enter-active,
  .voice-headline-leave-active,
  .live-line-enter-active,
  .live-line-leave-active,
  .voice-stage__orb-wrap {
    transition: none;
  }
}
</style>
